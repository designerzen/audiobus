// create MidiCommands
import MidiCommand from './MidiCommand';

export default class MidiCommandFactory
{
  constructor()
  {

  }

  // Takes a midi command and converts it into something useful
  public static convertChannelMessage( command:number ):string
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
          return MidiCommand.COMMAND_SYSTEM_MESSAGE;
      }
      return MidiCommand.COMMANDS[item];
  }

  // set
  public static create( eventData: Uint8Array ):MidiCommand
  {
      // each eventData is an array of 8-digit binary byte
      // usually represented as a hexadecimal integer 00-FF
      // or a number betweeo 0-255
      var command:MidiCommand = new MidiCommand();
      var commandByte:number = eventData[0];
      var type = commandByte & 0xf0; // channel agnostic message type. Thanks, Phil Burk.

      // store original data
      command.raw = eventData;

      // 0.  If zero, then the byte is a data byte, and if one, then the byte is a command byte
      // 1. Command byte
      //command.cmd = commandByte >> 4;

      command.channel = commandByte & 0xf;

      command.noteNumber = eventData[1] || 0;
      command.velocity = eventData[2] || 0;

      command.type = MidiCommandFactory.convertChannelMessage( commandByte >> 4 );
      //console.log( this.toString() );

      //console.error( this.cmd.toString(16),this.channel.toString(16),this.type.toString(16),this.note.toString(16),this.velocity.toString(16) );
      switch (type)
      {
          case 240: //
              //
              //command.type = MidiCommand.COMMAND_CONTROLLER;
              break;

          case 176: //
              //
              break;

          case 144:
              // noteOn message
              command.type = MidiCommand.COMMAND_NOTE_ON;
              break;

          case 128:
              // noteOff message
              command.type = MidiCommand.COMMAND_NOTE_OFF;
              break;
      }
      return command;
  }

}
