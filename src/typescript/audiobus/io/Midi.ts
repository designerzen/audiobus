/// <reference path="../Dependencies.ts"/>
module audiobus.io
{
    export class Midi
    {
        public inputID:string = undefined;
        public outputID:string = undefined;

        public available:boolean = false;
        public availableIn:boolean = false;
        public availableOut:boolean = false;

        public connectedInput:WebMidi.MIDIInput;
        public connectedOutput:WebMidi.MIDIOutput;

        public onmidiconnected:Function = function(message:MidiMessage){};
        public onmididisconnected:Function = function(message:MidiMessage){};
        public onmidimessage:Function = function(message:MidiMessage){};

        public midiAccess:WebMidi.MIDIAccess;

        private messagePool:Array<MidiMessage>;

        public static PORT_TYPE_INPUT:string = "input";
        public static PORT_TYPE_OUTPUT:string = "output";

        public static PORT_DEVICE_STATE_CONNECTED:string = "connected";
        public static PORT_DEVICE_STATE_DISCONNECTED:string = "disconnected";

        public static PORT_CONNECTION_STATE_OPEN:string = "open" ;
        public static PORT_CONNECTION_STATE_CLOSED:string = "closed";
        public static PORT_CONNECTION_STATE_PENDING:string = "pending";

        constructor(  )
        {

        }
        public static frequencyFromNote(note:number):number
        {
            return 440 * Math.pow(2, (note - 69) / 12);
        }
        public connect( requestedDevice:string=undefined ):boolean
        {
            if (requestedDevice)
            {
                this.inputID = requestedDevice;
                console.log('looking for midi device '+requestedDevice );
            }else{
                console.log('looking for midi devices' );
            }

            // request MIDI access
            if (navigator.requestMIDIAccess)
            {
                navigator.requestMIDIAccess({
                    sysex: false
                }).then( (event) => this.onMIDISuccess(event), (event) => this.onMIDIFailure(event) );
                return true;
            } else {
                this.onMIDIFailure(null);
                return false;
            }
        }

        // INPUT --------------------------------------------------------------
        private createMessage( data: Uint8Array ):MidiMessage
        {
            // look to see if there ae any in our pool...
            return new audiobus.io.MidiMessage( data );
        }

        private connectInput( deviceName:string ):WebMidi.MIDIInput
        {
            // now check to see that we have an input with that id
            var input:WebMidi.MIDIInput = this.getInput( deviceName );

            // check to see if this device was located...
            if (input)
            {
                // success, device located
                input.onmidimessage = (event: WebMidi.MIDIMessageEvent)=>{
                    this.onMIDIMessage(event);
                };
                // ensure that there are more than zero devices...
                this.availableIn = true;

                return input;
            }else{
                // we got no MIDI device with that name
                this.availableIn = false;
            }
            return null;
        }

        // success
        private onMIDISuccess( access: WebMidi.MIDIAccess ):void
        {
            var success:boolean = false;
            //console.log("MIDI Connected");
            this.midiAccess = access;
            this.messagePool = new Array();
            this.available = true;

            // Now connect to out input port if possible
            if (this.inputID)
            {
                this.connectedInput = this.connectInput( this.inputID );
                // we can check to see if this has succeeded or not
            }else{
                this.getInputs();
            }

            // Now connect to our output port
            this.getOutputs();

            /*
            // now do outputs!
            var values = output.value;
            console.log("Input port : [ type:'" + values.type + "' id: '" + values.id +
                "' manufacturer: '" + values.manufacturer + "' name: '" + values.name +
                "' version: '" + values.version + "']");
            */

            // listen for connect/disconnect message
            this.midiAccess.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
                this.onStateChange (event);
            };
        }

        private getInput(name:string):WebMidi.MIDIInput
        {
            var inputs:WebMidi.MIDIInputMap = this.midiAccess.inputs;
            var inputValues = inputs.values();
            // loop through all inputs
            for (var input = inputValues.next(); input && !input.done; input = inputValues.next())
            {
                var values:WebMidi.MIDIInput = input.value;
                if (values.name === name)
                {
                    return values;
                }
            }
            return null;
        }


        private getInputs()
        {
            var inputs:WebMidi.MIDIInputMap = this.midiAccess.inputs;
            var inputValues = inputs.values();
            // Things you can do with the MIDIAccess object:
            //  var inputs = this.midiAccess.inputs; // inputs = MIDIInputMaps, you can retrieve the inputs with iterators
            //  var outputs = this.midiAccess.outputs; // outputs = MIDIOutputMaps, you can retrieve the outputs with iterators

            // loop through all inputs
            for (var input = inputValues.next(); input && !input.done; input = inputValues.next())
            {
                var values = input.value;
                console.log("Input port : [ type:'" + values.type + "' id: '" + values.id +
                    "' manufacturer: '" + values.manufacturer + "' name: '" + values.name +
                    "' version: '" + values.version + "']");

                // listen for midi messages
                input.value.onmidimessage = (event: WebMidi.MIDIMessageEvent)=>{
                    this.onMIDIMessage(event);
                };
            }
        }

        private onStateChange(event: WebMidi.MIDIConnectionEvent)
        {
            var port:WebMidi.MIDIPort = event.port,
                state:string = port.state,
                name:string = port.name,
                type:string = port.type;

            switch(type)
            {
                case Midi.PORT_DEVICE_STATE_CONNECTED:
                    console.log("name", name, "port", port, "state", state);
                    if ( !this.connectedInput && this.available && !this.availableIn )
                    {
                        // re-attempt to connect
                        this.connectedInput = this.connectInput( this.inputID );
                    }
                    break;

                case Midi.PORT_DEVICE_STATE_DISCONNECTED:
                    console.log("name", name, "port", port, "state", state);
                    if (name === this.inputID)
                    {
                        // we have disconnected input!
                        this.connectedInput = null;
                        this.availableIn = false;

                    }else if (name === this.outputID){

                        // we have disconnected output!
                        this.connectedOutput = null;
                        this.availableOut = false;
                    }

                    // close the port
                    port.close();

                    break;
            }
        }



        // EVENT : A MIDI message has been received from the Input
        private onMIDIMessage( event:WebMidi.MIDIMessageEvent )
        {
            var message:MidiMessage = this.createMessage(event.data);
            this.onmidimessage.call(this, message);     // now dispatch this event...
            //console.log('data', data, 'cmd', cmd, 'channel', channel);
        }

        // failure
        private onMIDIFailure(e):void
        {
            this.available = false;
            console.log("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e);
        }



        // OUTPUT --------------------------------------------------------------
        private getOutput(name:string):WebMidi.MIDIOutput
        {
            var outputs:WebMidi.MIDIOutputMap = this.midiAccess.outputs;
            var outputValues = outputs.values();
            // loop through all inputs
            for (var output = outputValues.next(); output && !output.done; output = outputValues.next())
            {
                var values:WebMidi.MIDIOutput = output.value;
                if (values.name === name)
                {
                    return values;
                }
            }
            return null;
        }

        private getOutputs()
        {
            var outputs:WebMidi.MIDIOutputMap = this.midiAccess.outputs;
            var outputValues = outputs.values();
        }

        /*
        // MIDI send
        public send(data, delay)
        { // set channel volume
    		output.send(data, delay * 1000);
    	}

    	public setController(channel, type, value, delay)
        {
    		output.send([channel, type, value], delay * 1000);
    	}

    	public setVolume(channel, volume, delay)
        { // set channel volume
    		output.send([0xB0 + channel, 0x07, volume], delay * 1000);
    	}

    	public programChange(channel, program, delay)
        { // change patch (instrument)
    		output.send([0xC0 + channel, program], delay * 1000);
    	}

    	public pitchBend(channel, program, delay)
        { // pitch bend
    		output.send([0xE0 + channel, program], delay * 1000);
    	}

    	public noteOn(channel, note, velocity, delay)
        {
    		output.send([0x90 + channel, note, velocity], delay * 1000);
    	}

    	public noteOff(channel, note, delay)
        {
    		output.send([0x80 + channel, note, 0], delay * 1000);
    	}

    	public chordOn(channel, chord, velocity, delay)
        {
    		for (var n = 0; n < chord.length; n ++)
            {
    			var note = chord[n];
    			output.send([0x90 + channel, note, velocity], delay * 1000);
    		}
    	}

    	public chordOff(channel, chord, delay)
        {
    		for (var n = 0; n < chord.length; n ++)
            {
    			var note = chord[n];
    			output.send([0x80 + channel, note, 0], delay * 1000);
    		}
    	}

    	public stopAllNotes()
        {
    		output.cancel();
    		for (var channel = 0; channel < 16; channel ++)
            {
    			output.send([0xB0 + channel, 0x7B, 0]);
    		}
        }
        */
    }

    export class MidiMessage
    {
        public data: Uint8Array;

        public cmd:number = -1;
        public channel:number = -1;
        public type:number;
        public note:number = -1;
        public velocity:number = -1;

        public action:string = 'na';

        public static ACTION_NOTE_ON:string = "noteOn";
        public static ACTION_NOTE_OFF:string = "noteOff";
        public static ACTION_AFTERTOUCH:string = "aftertouch";
        public static ACTION_CONTROL_CHANGE:string = "controlChange";
        public static ACTION_PITCH_BEND:string = "pitchbend";
        public static ACTION_SYSTEM_MESSAGE:string = "systemMessage";
        public static ACTION_CHANNEL_PRESSURE:string = "channelPressure";
        public static ACTION_PATCH_CHANGE:string = "patchChange";

        public static ACTIONS:Array<string> = [
            MidiMessage.ACTION_NOTE_OFF,
            MidiMessage.ACTION_NOTE_ON,
            MidiMessage.ACTION_AFTERTOUCH,
            MidiMessage.ACTION_CONTROL_CHANGE,
            MidiMessage.ACTION_PATCH_CHANGE,
            MidiMessage.ACTION_CHANNEL_PRESSURE,
            MidiMessage.ACTION_PITCH_BEND,
            MidiMessage.ACTION_SYSTEM_MESSAGE
        ];
        // with pressure and tilt off
        // note off: 128, cmd: 8
        // note on: 144, cmd: 9
        // pressure / tilt on
        // pressure: 176, cmd 11:
        // bend: 224, cmd: 14

        constructor( eventData: Uint8Array=undefined )
        {
            if (eventData)
            {
                this.reset(eventData);
            }
        }
        public toString():string
        {
            var ouput:string = 'MIDI:Input::'+this.action;
            return ouput + ' [Channel '+this.channel+'] Type:'+this.type+' Note:'+this.note.toString(16)+ ' Velocity:'+this.velocity.toString(16) ;
        }

        // Takes a midi command and converts it into something useful
        private convertCommand( command:number ):string
        {
            /*
            command-nibble 	command-name 	data-bytes 	data-meaning

            Channel Messages :
            8 	note-off 	         2 	     key #; release velocity
            9 	note-on 	         2 	     key #; attack velocity
            A 	aftertouch 	         2 	     key #; key pressure
            B 	control-change 	     2 	     controller #; controller data
            C 	patch-change 	     1 	     instrumnet #
            D 	channel-pressure 	 1 	     channel pressure
            E 	pitch-bend 	         2 	     lsb; msb

            System Messages :
            F 	system-message 	     0       or variable 	none or sysex
            	start of system exclusive message 	variable
            0xF1 	MIDI Time Code Quarter Frame (Sys Common)
            0xF2 	Song Position Pointer (Sys Common)
            0xF3 	Song Select (Sys Common)
            0xF4 	???
            0xF5 	???
            0xF6 	Tune Request (Sys Common)
            0xF7 	end of system exclusive message 	0
            0xF8 	Timing Clock (Sys Realtime)
            0xFA 	Start (Sys Realtime)
            0xFB 	Continue (Sys Realtime)
            0xFC 	Stop (Sys Realtime)
            0xFD 	???
            0xFE 	Active Sensing (Sys Realtime)
            0xFF 	System Reset (Sys Realtime)
            */
            var item:number = command-8;
            // check to see if we have a system message...
            if (item > 6)
            {
                return MidiMessage.ACTION_SYSTEM_MESSAGE;
            }
            return MidiMessage.ACTIONS[item];
        }

        // clear all data
        public reset( eventData: Uint8Array ):void
        {
            // each eventData is an array of 8-digit binary byte
            // usually represented as a hexadecimal integer 00-FF
            // or a number betweeo 0-255
            var commandByte:number = eventData[0];

            this.data = eventData;
            // 0.  If zero, then the byte is a data byte, and if one, then the byte is a command byte
            // 1. Command byte
            this.cmd = commandByte >> 4;
            this.channel = commandByte & 0xf;
            this.type = commandByte & 0xf0; // channel agnostic message type. Thanks, Phil Burk.

            this.note = eventData[1] || 0;
            this.velocity = eventData[2] || 0;

            this.action = this.convertCommand(this.cmd);
            //console.log( this.toString() );

            switch (this.type) {
                case 240: //
                     //
                     break;
                case 176: //
                     //
                     break;
                case 144: // noteOn message
                     //noteOn(note, velocity);
                      //console.error( this.cmd.toString(16),this.channel.toString(16),this.type.toString(16),this.note.toString(16),this.velocity.toString(16) );
                     break;
                case 128: // noteOff message
                    //noteOff(note, velocity);
                    break;
            }
        }
    }
}

/*
function player(note, velocity) {
    var sample = sampleMap['key' + note];
    if (sample) {
        if (type == (0x80 & 0xf0) || velocity == 0) { //QuNexus always returns 144
            btn[sample - 1].classList.remove('active');
            return;
        }
        btn[sample - 1].classList.add('active');
        btn[sample - 1].play(velocity);
    }
}
*/
