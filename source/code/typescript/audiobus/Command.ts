/*//////////////////////////////////////////////////////////////////////////////

Midi Command
==============
Abstract    - A Midi Command Model - no logic - just data
Description - convert a midi chunk to a midicommand then pass around to stuff
Use         -
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import ICommand from './ICommand';

export default class Command implements ICommand
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

  public deltaTime:number;
  public frameRate:number;
  public channel:number = -1; // all channels

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
  public noteNumber:number = -1;  // no note (probably system message)
  public velocity:number = -1;    // not a note
  public value:number;

  public controllerType:number;
  public programNumber:number;
  public sequenceNumber:number;

  // for tracks that are precompiled, this serves as a handy place to store
  // the actual position in the track that the command occurs at
  public timeCode:number;

  public toString():string
  {
    var ouput:string = '[Command > '+this.subtype+']';
    if (this.type === Command.TYPE_META)
    {
      return ouput + ':' + this.deltaTime + ' [Meta] Type:'+this.type ;
    }else{
      return ouput + ':' + this.deltaTime + ' [Channel '+this.channel+'] Type:'+this.type+' Note:'+this.noteNumber.toString(16)+ ' Velocity:'+this.velocity.toString(16) ;
    }
  }
}
