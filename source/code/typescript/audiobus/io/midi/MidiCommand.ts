/*//////////////////////////////////////////////////////////////////////////////

Midi Command
==============
Abstract    - A Midi Command Model - no logic - just data
Description - convert a midi chunk to a midicommand then pass around to stuff
Use         -
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import ICommand from '../../ICommand';
import Command from '../../Command';

export default class MidiCommand extends Command implements ICommand
{
  // Types!
  public static TYPE_CHANNEL:string                   = 'channel';
  public static TYPE_META:string                      = 'meta';
  public static TYPE_SYSTEM_EXCLUSIVE:string          = 'sysEx';
  public static TYPE_DIVIDED_SYSTEM_EXCLUSIVE:string  = 'dividedSysEx';

  // The order of the Midi Codes so that you can map them easier
  public static COMMANDS:Array<string> = [
      Command.COMMAND_NOTE_OFF,
      Command.COMMAND_NOTE_ON,
      Command.COMMAND_NOTE_AFTER_TOUCH,
      Command.COMMAND_CONTROLLER,
      Command.COMMAND_PROGRAM_CHANGE,
      Command.COMMAND_CHANNEL_PRESSURE,
      Command.COMMAND_PITCH_BEND,
      Command.COMMAND_SYSTEM_MESSAGE
  ];

  // Settings?
  public raw:Uint8Array;

  // overridden...
  public toString():string
  {
    var ouput:string = '[MidiCommand > '+this.subtype+']';
    if (this.type === MidiCommand.TYPE_META)
    {
      return ouput + ':' + this.deltaTime + ' [Meta] Type:'+this.type ;
    }else{
      return ouput + ':' + this.deltaTime + ' [Channel '+this.channel+'] Type:'+this.type+' Note:'+this.noteNumber.toString(16)+ ' Velocity:'+this.velocity.toString(16) ;
    }
  }
}
