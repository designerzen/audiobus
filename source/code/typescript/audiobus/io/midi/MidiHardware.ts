import MidiCommand from './MidiCommand';
//import * as _ from "webaudioapi";
//import * as _ from "webmidi";

export default class MidiHardware
{
    public inputID:string = undefined;
    public outputID:string = undefined;

    public available:boolean = false;
    public availableIn:boolean = false;
    public availableOut:boolean = false;

    public connectedInput:WebMidi.MIDIInput;
    public connectedOutput:WebMidi.MIDIOutput;

    public onmidiconnected:Function = function(message:MidiCommand){};
    public onmididisconnected:Function = function(message:MidiCommand){};
    public onmidimessage:Function = function(message:MidiCommand){};

    public midiAccess:WebMidi.MIDIAccess;

    private messagePool:Array<MidiCommand>;

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
            case MidiHardware.PORT_DEVICE_STATE_CONNECTED:
                console.log("name", name, "port", port, "state", state);
                if ( !this.connectedInput && this.available && !this.availableIn )
                {
                    // re-attempt to connect
                    this.connectedInput = this.connectInput( this.inputID );
                }
                break;

            case MidiHardware.PORT_DEVICE_STATE_DISCONNECTED:
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
        var message:MidiCommand = MidiCommandFactory.create( event.data);
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

    // use a midi event to send to the hardware
    public send( command:MidiCommand )
    {
        this.connectedOutput.send( [ Number(command.data) ], command.deltaTime * 1000);
    }
    /*
    // MIDI send
    public send(data, delay)
    { // set channel volume
		this.connectedOutput.send(data, delay * 1000);
	}

	public setController(channel, type, value, delay)
    {
		this.connectedOutput.send([channel, type, value], delay * 1000);
	}

	public setVolume(channel, volume, delay)
    { // set channel volume
		this.connectedOutput.send([0xB0 + channel, 0x07, volume], delay * 1000);
	}

	public programChange(channel, program, delay)
    { // change patch (instrument)
		this.connectedOutput.send([0xC0 + channel, program], delay * 1000);
	}

	public pitchBend(channel, program, delay)
    { // pitch bend
		this.connectedOutput.send([0xE0 + channel, program], delay * 1000);
	}

	public noteOn(channel, note, velocity, delay)
    {
		this.connectedOutput.send([0x90 + channel, note, velocity], delay * 1000);
	}

	public noteOff(channel, note, delay)
    {
		this.connectedOutput.send([0x80 + channel, note, 0], delay * 1000);
	}

	public chordOn(channel, chord, velocity, delay)
    {
		for (var n = 0; n < chord.length; n ++)
        {
			var note = chord[n];
			this.connectedOutput.send([0x90 + channel, note, velocity], delay * 1000);
		}
	}

	public chordOff(channel, chord, delay)
    {
		for (var n = 0; n < chord.length; n ++)
        {
			var note = chord[n];
			this.connectedOutput.send([0x80 + channel, note, 0], delay * 1000);
		}
	}

	public stopAllNotes()
    {
		this.connectedOutput.cancel();
		for (var channel = 0; channel < 16; channel ++)
        {
			this.connectedOutput.send([0xB0 + channel, 0x7B, 0]);
		}
    }
    */
}
