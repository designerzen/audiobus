/*

Where MIDI Hardware augments access to inputs and outputs to the MIDI ports
connected to the device, the MIDI Hardware Device augments the actual MIDI IN
and MIDI OUTs into a format that subscribes to the interface of other devices.

Therefore, so long as all harwdware has an appropriate interface, they will all
be able to communicate with one another...

A MIDI Hardware Device wraps up all inputs and outputs for a particular instrument
For example, the K-Mixer board when connected to a machine shows up as 3 inputs
and 3 outputs all with specific named ports.

This class therefore allows us to group these inputs and outputs together

*/

import ICommand from '../../ICommand';
import MidiCommand from './MidiCommand';
import MidiHardware from './MidiHardware';
import MidiCommandFactory from './MidiCommandFactory';
import {MidiCommandCodes,MidiChannelMessages} from './MidiCodes';
import TimeNow from '../../timing/TimeNow';

export default class MidiHardwareDevice
{
  // things to connect to...
  public connectedInputs:Array<WebMidi.MIDIInput> = [];
  public connectedOutputs:Array<WebMidi.MIDIOutput> = [];

  public inputLibrary:Object = {};
  public outputLibrary:Object = {};

  public midiHardware:MidiHardware;

  protected name:string;

  // you should piggyback these!
  public onmidiconnected:Function = (message:MidiCommand)=>{};
  public onmididisconnected:Function = (message:MidiCommand)=>{};
  public onMidi:{(alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent):void} = (alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent):void=>{};

  public get inputs():Array<WebMidi.MIDIInput>
  {
    return this.connectedInputs;
  }

  public get outputs():Array<WebMidi.MIDIOutput>
  {
    return this.connectedOutputs;
  }

  constructor( deviceAlias:string )
  {
    // best give this a unique name unless you wish to overwrite them
    this.name = deviceAlias;
    this.midiHardware = new MidiHardware();
  }

  public getInput(alias:string):WebMidi.MIDIInput
  {
    const input:WebMidi.MIDIInput = this.inputLibrary[ alias ];
    // throw error if not loaded?
    return input ? input : null;
  }

  public getOutput(alias:string):WebMidi.MIDIOutput
  {
    return this.outputLibrary[ alias ];
  }

  // you must always provide a name to refer to this input in future...
  public addInput( alias:string, requested:{ id?:string, manufacturer?:string, name?:string, version?:string} ):Promise<WebMidi.MIDIInput>
  {
    return new Promise<WebMidi.MIDIInput>( (resolve:{(input:WebMidi.MIDIInput):void}, reject) => {

      // ---
      this.midiHardware.getInputDevice( requested ).then(

        // success!
        (device:WebMidi.MIDIInput)=>{

          this.connectedInputs.push(device);
          this.inputLibrary[ alias ] = device;

          device.onmidimessage = (event:WebMidi.MIDIMessageEvent)=>{
            const command:MidiCommand = MidiCommandFactory.create( event.data);
            //console.error("Midi message received...",device, event, command);
            this.onMidiMessage( alias, device, event );
          }
          console.log("Midi input device located",device);
          resolve(device);
        },
        // failure
        (error)=>{
          reject(error);
        }
      );
      // ---

    });

  }
  // you must always provide a name to refer to this input in future...
  public addOutput( alias:string, requested:{ id?:string, manufacturer?:string, name?:string, version?:string} ):Promise<WebMidi.MIDIOutput>
  {
    return new Promise<WebMidi.MIDIOutput>( (resolve:{(output:WebMidi.MIDIOutput):void}, reject) => {

      // ---
      this.midiHardware.getOutputDevice( requested ).then(

        (device:WebMidi.MIDIOutput)=>{
        // success!

          this.connectedOutputs.push(device);
          this.outputLibrary[ alias ] = device;

          console.error("Midi output device located",device);
          // send it some data!
          resolve(device);
        },
        // failure
        (error)=>{
          reject(error);
        }
      );
      // ---

    });

  }

  // handy!
  private commandMIDIOutput( command:ICommand ):Array<number>
  {
    let note:number = 0;
    const channel:number = 0;
    const data:Array<number> = [];
    //console.error( "command", command );
    switch( command.type )
    {
      case MidiCommand.COMMAND_NOTE_OFF:
        note = 0;
        //noteOff(channel:number, note:number, delay:number=0, port?:WebMidi.MIDIOutput)
        // this.noteOff( channel, note, delay );
        break;

      case MidiCommand.COMMAND_NOTE_ON:
        //noteOn(channel:number, note:number, velocity:number, delay:number=0, port?:WebMidi.MIDIOutput)
        // this.noteOn();
        break;

      case MidiCommand.COMMAND_NOTE_AFTER_TOUCH:

        break;

      case MidiCommand.COMMAND_CONTROLLER:

        break;

      case MidiCommand.COMMAND_PROGRAM_CHANGE:

        break;

      case MidiCommand.COMMAND_CHANNEL_PRESSURE:

        break;

      case MidiCommand.COMMAND_PITCH_BEND:

        break;

      case MidiCommand.COMMAND_SYSTEM_MESSAGE:

        break;

    }
    return data;
  }

  // Here we can send a MIDICommand directly to the hardware...
  // if no port is provided, we send it out to all available outputs...
  public command( action:ICommand, toChannel?:number, port?:WebMidi.MIDIOutput ):void
  {
    const channel:number = toChannel ? toChannel : action.channel;
    //const data:Array<number> = [];
    let delay:number = action.deltaTime;

    //console.error( "command", { subtype:action.subtype, delay, channel} );
    switch( action.subtype )
    {
      case MidiCommand.COMMAND_NOTE_OFF:
      //console.error( "command:note off", action.type );
        //noteOff(channel:number, note:number, delay:number=0, port?:WebMidi.MIDIOutput)
        this.noteOff( channel, action.noteNumber, delay, port );
        break;

      case MidiCommand.COMMAND_NOTE_ON:
      //console.error( "command:not on", action.type );
        //noteOn(channel:number, note:number, velocity:number, delay:number=0, port?:WebMidi.MIDIOutput)
        this.noteOn( channel, action.noteNumber, action.velocity, delay, port);
        break;

      case MidiCommand.COMMAND_NOTE_AFTER_TOUCH:

        break;

      case MidiCommand.COMMAND_CONTROLLER:
        // setController(channel:number, type:number, value:number, delay:number=0, port?
        // this.setController(channel, type:number, action.value, delay, port);
        break;

      case MidiCommand.COMMAND_PROGRAM_CHANGE:
        //  programChange(channel:number, program:number, delay:number=0, port?
        // this.programChange( channel, program, delay, port );
        break;

      case MidiCommand.COMMAND_CHANNEL_PRESSURE:

        break;

      case MidiCommand.COMMAND_PITCH_BEND:
        // channel:number, program:number, delay:number=0, port?
        // this.pitchBend( channel, program, delay, port );
        break;

      case MidiCommand.COMMAND_SYSTEM_MESSAGE:

        break;

      default:
        // send if unknown!
        //this.send(data, delay, port);
    }

  }


  public send( data:Array<number>, delay:number=0, port?:WebMidi.MIDIOutput ):void
  {
    const time:number = TimeNow() + (delay*1000);
    // omitting the timestamp means send immediately...
    if (port)
    {
      //console.error("Sending MIDI OUT : ", data, delay, port);
      port.send(data, time);
    }else{
      //console.error("Sending BULK MIDI OUT : ", data, delay, this.connectedOutputs );
      this.connectedOutputs.forEach( (output:WebMidi.MIDIOutput)=>{
        //console.error("Sending MIDI OUT : ", data, delay, output);
        output.send(data, time);
      });
    }
  }
  //
  //
  // send(control, value, time, bank = 1)
  // {
  // 			let output, message,
  // 					port = ports[0],
  // 					controlType = getControlType(control);
  //
  // 			time = time || 0
  //
  // 			switch(controlType){
  // 				case 'raw':
  // 					// raw : send([176,1,127], time)
  // 					message = control
  // 					time = value || 0
  // 					port = ports[0];
  //
  // 					break;
  //
  // 				case 'raw-control':
  // 					// raw-control : send('control',[176,1,127], time)
  // 					message = value
  // 					port = ports[1];
  //
  // 					break;
  //
  // 				case 'control':
  // 					// to control-surface : send('control:button-vu',0), send('control:fader-1', 64)
  // 					port = ports[1];
  // 					control = control.split(':')[1]
  // 					message = controlMessageFromOptions(control, value, bank, options)
  //
  // 					break;
  //
  // 				default: // 'input', 'main', 'misc', 'preset'
  // 					// to audio control : send('fader:1', value, time)
  // 					message = controlMessage(control, value, controlType)
  //
  // 					break;
  // 			}
  //
  // 			output = midi.outputs.get(devices[device][port].outputID)
  //
  // 			if(message.length < 3 && controlType !== 'preset') {
  // 				console.log('Please check control name');
  // 			} else {
  // 				output.send(message,  window.performance.now() + time)
  // 			}
  // 			// chaining
  // 			return this
  // }


  // one of the channels has spawned a midi message! huzzah!
  protected onMidiMessage( alias:string, device:WebMidi.MIDIInput, event:WebMidi.MIDIMessageEvent ):void
  {
    //console.error(arguments);
    this.onMidi && this.onMidi(alias, device, event);
  }

  // MIDI send controls. These are handy for public controlling of your devices.
  // If you just wish to interface with another midi device or a midi file,
  // it is probably easier to stick to using the ICommand system which should
  // automatically bind things together :)

  public setController(channel:number, type:number, value:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    //send( data:Array<number>, delay:number, port?:WebMidi.MIDIOutput )
    this.send([channel, type, value], delay);
  }

  public setVolume(channel:number, volume:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    // set channel volume
    this.send([MidiCommandCodes.CONTROLLER + channel, MidiCommandCodes.CUE_POINT, volume], delay);
  }

  public programChange(channel:number, program:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    // change patch (instrument)
    this.send([MidiCommandCodes.PROGRAM_CHANGE + channel, program], delay);
  }

  public pitchBend(channel:number, program:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    // pitch bend
    this.send([MidiCommandCodes.PITCH_BEND + channel, program], delay);
  }

  public noteOn(channel:number, note:number, velocity:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    this.send([MidiCommandCodes.NOTE_ON + channel, note, velocity], delay);
  }

  public noteOff(channel:number, note:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    this.send([MidiCommandCodes.NOTE_OFF + channel, note, 0], delay);
  }

  public chordOn(channel:number, chord:number, velocity:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    // for (var n = 0; n < chord.length; n ++)
    //     {
    //   var note = chord[n];
    //   this.send([MidiCommandCodes.NOTE_ON + channel, note, velocity], delay);
    // }
  }

  public chordOff(channel:number, chord:number, delay:number=0, port?:WebMidi.MIDIOutput)
  {
    // for (var n = 0; n < chord.length; n ++)
    // {
    //   const note = chord[n];
    //   this.send([MidiCommandCodes.NOTE_OFF + channel, note, 0], delay);
    // }
  }

  public stopAllNotes( channel:number, port?:WebMidi.MIDIOutput )
  {
    // FIXME :
    //this.connectedOutput.cancel();
    this.send( [MidiCommandCodes.CONTROLLER + channel, MidiCommandCodes.STOP_ALL, 0] , 0);

  }


}
