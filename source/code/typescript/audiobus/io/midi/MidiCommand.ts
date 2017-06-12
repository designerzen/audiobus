/*//////////////////////////////////////////////////////////////////////////////

Midi Command
==============
Abstract    - A Midi Command Model - no logic - just data
Description - convert a midi chunk to midicommand then pass around
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
export default class MidiCommand
{
  // Types!
  public static TYPE_CHANNEL:string                   = 'channel';
  public static TYPE_META:string                      = 'meta';
  public static TYPE_SYSTEM_EXCLUSIVE:string          = 'sysEx';
  public static TYPE_DIVIDED_SYSTEM_EXCLUSIVE:string  = 'dividedSysEx';

  // Commands!
  public static COMMAND_NOTE_OFF:string               = 'noteOff';
  public static COMMAND_NOTE_ON:string                = 'noteOn';
  public static COMMAND_NOTE_AFTER_TOUCH:string       = 'noteAftertouch';
  public static COMMAND_CONTROLLER:string             = 'controller';
  public static COMMAND_PROGRAM_CHANGE:string         = 'programChange';

  public static COMMAND_CHANNEL_AFTER_TOUCH:string    = 'channelAftertouch';
  public static COMMAND_CHANNEL_PRESSURE:string       = 'channelPressure';

  public static COMMAND_PITCH_BEND:string             = 'pitchBend';
  public static COMMAND_SYSTEM_MESSAGE:string         = 'systemMessage';

  public static COMMANDS:Array<string> = [
      MidiCommand.COMMAND_NOTE_OFF,
      MidiCommand.COMMAND_NOTE_ON,
      MidiCommand.COMMAND_NOTE_AFTER_TOUCH,
      MidiCommand.COMMAND_CONTROLLER,
      MidiCommand.COMMAND_PROGRAM_CHANGE,
      MidiCommand.COMMAND_CHANNEL_PRESSURE,
      MidiCommand.COMMAND_PITCH_BEND,
      MidiCommand.COMMAND_SYSTEM_MESSAGE
  ];

  // Settings
  public raw:Uint8Array;

  public deltaTime:number;
  public frameRate:number;
  public channel:number;

  public type:string;
  public subtype:string;
  public text:string;
  public data:string;

  public hour:number;
  public min:number;
  public sec:number;
  public frame:number;
  public subframe:number;
  public microsecondsPerBeat:number;

  public key:number;
  public scale:number;
  public numerator:number;
  public denominator:number;
  public metronome:number;
  public thirtyseconds:number;

  public amount:number;
  public noteNumber:number;
  public velocity:number;
  public value:number;

  public controllerType:number;
  public programNumber:number;
  public sequenceNumber:number;

  public toString():string
  {
    var ouput:string = 'MIDI:Input::'+this.subtype;
    return ouput + ' [Channel '+this.channel+'] Type:'+this.type+' Note:'+this.noteNumber.toString(16)+ ' Velocity:'+this.velocity.toString(16) ;
  }
}
