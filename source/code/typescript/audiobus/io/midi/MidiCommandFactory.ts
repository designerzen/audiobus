// create MidiCommands
import MidiCommand from './MidiCommand';
import {MidiEventCodes,MidiSystemCodes,MidiMetaCodes,MidiCommandCodes} from './MidiCodes';

export default class MidiCommandFactory
{
  constructor()
  {

  }

  //////////////////////////////////////////////////////////////////////////////
  // Channel Voice
  // Control the instrument's 16 voices (timbres, patches),
  // plays notes, sends controller data, etc.
  //////////////////////////////////////////////////////////////////////////////
  public static decodeChannelEvent( event:MidiCommand, eventTypeByte:number ):MidiCommand
  {
      const eventType = eventTypeByte >> 4;

      switch (eventType)
      {
        case MidiEventCodes.NOTE_OFF:
          return event;

        case MidiEventCodes.NOTE_ON:

          return event;

        case MidiEventCodes.NOTE_AFTER_TOUCH:

          return event;

        case MidiEventCodes.CONTROLLER:

          return event;

        // Program Change or Patch Change
        // This means that the instrument has changed...
        case MidiEventCodes.PROGRAM_CHANGE:

          return event;

        case MidiEventCodes.CHANNEL_AFTER_TOUCH:

          return event;

        case MidiEventCodes.PITCH_BEND:
            return event;

        // SYSTEM EXCLUSIVE
        case MidiEventCodes.SYSTEM_EXCLUSIVE:
          return event;


        default:
          throw "Unrecognised MIDI event type: " + eventType;
          /*
          console.log("Unrecognised MIDI event type: " + eventType);
          stream.readInt8();
          event.subtype = 'unknown';
          return event;
          */
      }
  }


  public static decodeSystemEvent( event:MidiCommand, eventTypeByte:number ):MidiCommand
  {
    // system / meta event
    switch (eventTypeByte )
    {
      case MidiSystemCodes.SYSTEM_EXCLUSIVE:
        return event;

      case MidiSystemCodes.TIME_CODE_QUARTER_FRAME:
        //0xF1 	MIDI Time Code Quarter Frame (Sys Common)
        break;

      case MidiSystemCodes.SONG_POSITION_POINTER:
        //0xF2 	Song Position Pointer (Sys Common)
        break;

      case MidiSystemCodes.SONG_SELECT:
        //0xF3 	Song Select (Sys Common)
        break;


      case MidiSystemCodes.TUNE_REQUEST:
        //0xF6 	Tune Request (Sys Common)
        break;

      case MidiSystemCodes.END_OF_MESSAGE:
        //0xF7 	end of system exclusive message 	0
        return event;

      case MidiSystemCodes.TIMING_CLOCK:
        // 0xF8 	Timing Clock (Sys Realtime)
        break;

      case MidiSystemCodes.START:
        //0xFA 	Start (Sys Realtime)
        break;

      case MidiSystemCodes.CONTINUE:
        //0xFB 	Continue (Sys Realtime)
        break;

      case MidiSystemCodes.STOP:
        //0xFC 	Stop (Sys Realtime)
        break;

      case 0xf4:
      case 0xf5:
      case 0xfd:
        // 	???
        break;

      case MidiSystemCodes.ACTIVE_SENSING:
        //0xFE 	Active Sensing (Sys Realtime)
        break;

      case MidiSystemCodes.SYSTEM_RESET:
        //this.decodeMetaEvent( stream, event, eventTypeByte );
        return event;

      default:

        // Not in the MIDI spec!
        throw "Unrecognised MIDI event type byte: " + eventTypeByte;
    }
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
      const decimalToHex = (d:number, padding:number) => {
          var hex = Number(d).toString(16);
          padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

          while (hex.length < padding) {
              hex = "0" + hex;
          }

          return hex;
      }

      switch(command)
      {
        case MidiEventCodes.NOTE_OFF:
          return MidiCommand.COMMAND_NOTE_OFF;

        case MidiEventCodes.NOTE_ON:
          return MidiCommand.COMMAND_NOTE_ON;

        default:
          //console.error("Midi code not recognised...", decimalToHex(command,2) );
      }

      const item:number = command-8;
      // check to see if we have a system message...
      if (item > 6)
      {
          return MidiCommand.COMMAND_SYSTEM_MESSAGE;
      }
      return MidiCommand.COMMANDS[item];
  }

  public static fromMidiEvent( midiEvent:WebMidi.MIDIMessageEvent ):MidiCommand
  {
    return this.create( midiEvent.data );
  }

  // set
  public static create( eventData: Uint8Array ):MidiCommand
  {
      // each eventData is an array of 8-digit binary byte
      // usually represented as a hexadecimal integer 00-FF
      // or a number betweeo 0-255
      const command:MidiCommand = new MidiCommand();
      const commandByte:number = eventData[0];
      const type = commandByte & 0xf0; // channel agnostic message type. Thanks, Phil Burk.
      const eventTypeByte:number = commandByte & 0xf0; // channel agnostic message type. Thanks, Phil Burk.

      // store original data
      command.raw = eventData;

      // 0.  If zero, then the byte is a data byte, and if one, then the byte is a command byte
      // 1. Command byte
      //command.cmd = commandByte >> 4;
      const isData:boolean = commandByte >> 4 === 0;

      if ((eventTypeByte & MidiSystemCodes.SYSTEM_EXCLUSIVE) === MidiSystemCodes.SYSTEM_EXCLUSIVE)
      {

        // SYSTEM EVENT
        //console.log("Command Factory > System event isData:"+isData);
      }else{
        // CHANNEL EVENT!
        console.log("Command Factory > Channel event isData:"+isData);
        command.type = MidiCommandFactory.convertChannelMessage( commandByte >> 4 );
      }

      command.channel = commandByte & 0xf;

      command.noteNumber = eventData[1] || 0;
      command.velocity = eventData[2] || 0;

        //console.log( this.toString() );

      //console.error( this.cmd.toString(16),this.channel.toString(16),this.type.toString(16),this.note.toString(16),this.velocity.toString(16) );
      // switch (type)
      // {
      //     case 240: //
      //         //
      //         //command.type = MidiCommand.COMMAND_CONTROLLER;
      //         break;
      //
      //     case 176: //
      //         //
      //         break;
      //
      //     case 144:
      //         // noteOn message
      //         command.type = MidiCommand.COMMAND_NOTE_ON;
      //         break;
      //
      //     case 128:
      //         // noteOff message
      //         command.type = MidiCommand.COMMAND_NOTE_OFF;
      //         break;
      // }
      return command;
  }

}
