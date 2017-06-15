/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi File
==============
Abstract    - decode a .midi file from an object in memory
Description - Buffers a .midi file into memory, parses the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -
Forked from - https://github.com/gasman/jasmid/blob/master/stream.js#L2
References  -
  https://www.midi.org/specifications/item/table-1-summary-of-midi-message
  http://www.indiana.edu/~emusic/etext/MIDI/chapter3_MIDI3.shtml
  http://www.gweep.net/~prefect/eng/reference/protocol/midispec.html#On

Channel Voice
    Control the instrument's 16 voices (timbres, patches), plays notes, sends
    controller data, etc.

Channel Mode
    Define instrument's response to Voice messages, sent over instrument's
    'basic' channel

System Common
    Messages intended to all networked instruments and devices

System Real-Time
    Intended for all networked instruments and devices. Contain only status
    bytes and is used for syncronization of all devices. essentially a timing
    clock

System Exclusive
    Originally used for manufacturer-specific codes, such as editor/librarians,
    has been expanded to include MIDI Time Code, MIDI Sample Dump Standard and
    MIDI Machine Control

//////////////////////////////////////////////////////////////////////////////*/
import MidiCommand from './MidiCommand';
import MidiHeader from './MidiHeader';
import MidiChunk from './MidiChunk';
import MidiTrack from './MidiTrack';
import MidiStream from './MidiStream';

import {MidiEventCodes,MidiSystemCodes,MidiMetaCodes} from './MidiCodes';

export default class MidiFileDecoder
{
  // some systems leave the last byte out
  // to preserve memory but here we can
  // re-add it if we want to :)

  // The MIDI spec allows for a MIDI message to be sent without its Status byte
  // (ie. just its data bytes are sent) as long as the previous, transmitted message had the same Status
  private lastEventTypeByte:number;

  constructor()
  {

  }

  public decode( stream:MidiStream ):MidiTrack
  {
    const header:MidiHeader = this.decodeHeader( stream );
    const track:MidiTrack = new MidiTrack( header );
    return this.decodeTracks( track, stream );
  }

  //////////////////////////////////////////////////////////////////////////////
  // Take a 4 byte chunk out of the data set and convert it into a chunk
  // As each MIDI message is 4 bytes, we can use this to read each message
  //////////////////////////////////////////////////////////////////////////////
  private readChunk(stream:MidiStream):MidiChunk
  {
    return new MidiChunk( stream );
  }

  private decodeHeader( stream:MidiStream ):MidiHeader
  {
    const headerChunk:MidiChunk = this.readChunk(stream);
    if (headerChunk.id !== MidiChunk.TYPE_HEADER || headerChunk.length !== 6)
    {
      throw "Bad .mid file - header not found";
    }
    // convert stream to data model...
    const headerStream:MidiStream = new MidiStream(headerChunk.data);
    return new MidiHeader( headerStream );
  }

  private decodeTracks( track:MidiTrack, stream:MidiStream ):MidiTrack
  {
    // we already have header info, but the info in header changes the behaviour
    // of this...
    const header:MidiHeader = track.header;
    console.log("Decoding MIDI track Header", header.toString() );
    switch(header.format)
    {
      // A Format 0 file has a header chunk followed by one track chunk.
      // It is the most interchangeable representation of data.
      // It is very useful for a simple single-track player in a program which
      // needs to make synthesisers make sounds, but which is primarily concerned
      // with something else such as mixers or sound effect boxes. It is very
      // desirable to be able to produce such a format, even if your program is
      // track-based, in order to work with these simple programs.
      case 0:

        break;

      // A Format 1 or 2 file has a header chunk followed by one or more track chunks. programs which support
      // several simultaneous tracks should be able to save and read data in format 1, a vertically one dimensional
      // form, that is, as a collection of tracks. Programs which support several independent patterns should be able to
      // save and read data in format 2, a horizontally one dimensional form. Providing these minimum capabilities
      // will ensure maximum interchangeability.
      case 1:
      case 2:

        break;

    }



    // In a MIDI system with a computer and a SMPTE synchroniser which uses Song Pointer and Timing Clock,
    // tempo maps (which describe the tempo throughout the track, and may also include time signature
    // information, so that the bar number may be derived) are generally created on the computer. To use them with
    // the synchroniser, it is necessary to transfer them from the computer. To make it easy for the synchroniser to
    // extract this data from a MIDI File, tempo information should always be stored in the first MTrk chunk. For a
    // format 0 file, the tempo will be scattered through the track and the tempo map reader should ignore the
    // intervening events; for a format 1 file, the tempo map must be stored as the first track. It is polite to a tempo
    // map reader to offer your user the ability to make a format 0 file with just the tempo, unless you can use
    // format 1.
    // All MIDI Files should specify tempo and time signature. If they don't, the time signature is assumed to be 4/4,
    // and the tempo 120 beats per minute. In format 0, these meta-events should occur at least at the beginning of
    // the single multi-channel track. In format 1, these meta-events should be contained in the first track. In format
    // 2, each of the temporally independent patterns should contain at least initial time signature and tempo
    // information.
    // Format IDs to support other structures may be defined in the future. A program encountering an unknown
    // format ID may still read other MTrk chunks it finds from the file, as format 1 or 2, if its user can make sense
    // of them and arrange them into some other structure if appropriate. Also, more parameters may be added to the
    // MThd chunk in the future: it is important to read and honour the length, even if it is longer than 6
    const tracks:Array<MidiCommand> = new Array();
    const quantity:number = header.trackCount;

    for (let i = 0; i < quantity; i++)
    {
        //tracks[i] = [];
        const trackChunk = this.readChunk(stream);
        // check to see if this is a header or a track...
        if (trackChunk.id !== MidiChunk.TYPE_TRACK)
        {
          throw "Unexpected chunk - expected "+MidiChunk.TYPE_TRACK+", got "+ trackChunk.id;
        }

        const trackStream:MidiStream = new MidiStream(trackChunk.data);
        while (!trackStream.eof())
        {
          const event:MidiCommand = this.readEvent(trackStream);
          // extract special bits
          switch(event.subtype)
          {
            case  'setTempo':
              // we have tempo here...
              track.bpm = 60000000 / event.microsecondsPerBeat;
              console.log("Setting BPM of MIDI track to ", track.bpm);

              break;

            case 'timeSignature':
              track.timeSignature = [event.numerator, event.denominator];
              console.log("Setting timeSignature of MIDI track to ",  [event.numerator, event.denominator] );
              break;

          }
          //tracks[i].push(event);
          track.addEvent( i, event );
        }
      }
      return track;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Pass in a stream and output a MidiCommand
  //
  //////////////////////////////////////////////////////////////////////////////
  public readEvent(stream:MidiStream):MidiCommand
  {
  	const event:MidiCommand = new MidiCommand();
    const time:number = stream.readVarInt();

    // hmmm
    const eventTypeByte:number = stream.readInt8();

    // set the delta time position (always first bytes)
    event.deltaTime = time;


    // Check for type of event...
    if ((eventTypeByte & MidiSystemCodes.SYSTEM_EXCLUSIVE) === MidiSystemCodes.SYSTEM_EXCLUSIVE)
    {
      // System event
      return this.decodeSystemEvent( stream, event, eventTypeByte);

    } else {

      // Channel event
      return this.decodeChannelEvent( stream, event, eventTypeByte);
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  // http://www.gweep.net/~prefect/eng/reference/protocol/midispec.html
  //////////////////////////////////////////////////////////////////////////////
  private decodeSystemEvent( stream:MidiStream, event:MidiCommand, eventTypeByte:number ):MidiCommand
  {
    // system / meta event
    switch (eventTypeByte )
    {
      case MidiSystemCodes.SYSTEM_EXCLUSIVE:
        event.type = MidiCommand.TYPE_SYSTEM_EXCLUSIVE;
        length = stream.readVarInt();
        event.data = stream.read(length);
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
        event.type = MidiCommand.TYPE_DIVIDED_SYSTEM_EXCLUSIVE;
        length = stream.readVarInt();
        event.data = stream.read(length);
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
        this.decodeMetaEvent( stream, event, eventTypeByte );
        return event;

      default:

        // Not in the MIDI spec!
        throw "Unrecognised MIDI event type byte: " + eventTypeByte;
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Channel Voice
  // Control the instrument's 16 voices (timbres, patches),
  // plays notes, sends controller data, etc.
  //////////////////////////////////////////////////////////////////////////////
  private decodeChannelEvent( stream:MidiStream, event:MidiCommand, eventTypeByte:number ):MidiCommand
  {
    // the first byte in the blck...
      let paramater1:number;

      // no event type sent so we re-use the last known one.
      if ((eventTypeByte & 0x80) === 0)
      {
        // running status - reuse lastEventTypeByte as the event type.
        // eventTypeByte is actually the first parameter in this case...
        paramater1 = eventTypeByte;
        eventTypeByte = this.lastEventTypeByte;
      } else {
        paramater1 = stream.readInt8();
        this.lastEventTypeByte = eventTypeByte;
      }

      const eventType = eventTypeByte >> 4;
      event.channel = eventTypeByte & 0x0f;
      event.type = MidiCommand.TYPE_CHANNEL;

      switch (eventType)
      {
        case MidiEventCodes.NOTE_OFF:
          event.subtype = MidiCommand.COMMAND_NOTE_OFF;//'noteOff';
          event.noteNumber = paramater1;
          event.velocity = stream.readInt8();
          return event;

        case MidiEventCodes.NOTE_ON:
          event.noteNumber = paramater1;
          event.velocity = stream.readInt8();
          if (event.velocity === 0)
          {
            // some older hardware used to send noteOn with zero velocity
            // instead of noteOff so we keep it here in preservation
            event.subtype =  MidiCommand.COMMAND_NOTE_OFF;
          } else {
            event.subtype = MidiCommand.COMMAND_NOTE_ON;//'noteOn';
          }
          return event;

        case MidiEventCodes.NOTE_AFTER_TOUCH:
          event.subtype = MidiCommand.COMMAND_NOTE_AFTER_TOUCH;
          event.noteNumber = paramater1;
          event.amount = stream.readInt8();
          return event;

        case MidiEventCodes.CONTROLLER:
          event.subtype = MidiCommand.COMMAND_CONTROLLER;
          event.controllerType = paramater1;
          event.value = stream.readInt8();
          return event;

        // Program Change or Patch Change
        case MidiEventCodes.PROGRAM_CHANGE:
          event.subtype = MidiCommand.COMMAND_PROGRAM_CHANGE;
          event.programNumber = paramater1;
          return event;

        case MidiEventCodes.CHANNEL_AFTER_TOUCH:
          event.subtype = MidiCommand.COMMAND_CHANNEL_AFTER_TOUCH;
          event.amount = paramater1;
          return event;

        case MidiEventCodes.PITCH_BEND:
          event.subtype = MidiCommand.COMMAND_PITCH_BEND;
          event.value = paramater1 + (stream.readInt8() << 7);
          return event;

        // SYSTEM EXCLUSIVE
        case MidiEventCodes.SYSTEM_EXCLUSIVE:
          event.subtype = MidiCommand.COMMAND_SYSTEM_MESSAGE;
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

  // Meta sub-events
  private decodeMetaEvent(stream:MidiStream, event:MidiCommand, eventTypeByte:number)
  {
    // 0xFF 	System Reset (Sys Realtime)
    const subtypeByte:number = stream.readInt8();
    const length:number = stream.readVarInt();

    // set as a meta event
    event.type = MidiCommand.TYPE_META;

    switch(subtypeByte)
    {
      case MidiMetaCodes.SEQUENCE_NUMBER:
          event.subtype = 'sequenceNumber';
          if (length !== 2)
          {
            throw "Expected length for sequenceNumber event is 2, got " + length;
          }
          event.sequenceNumber = stream.readInt16();
          return event;

      case MidiMetaCodes.TEXT:
          event.subtype = 'text';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.COPYRIGHT_NOTICE:
          event.subtype = 'copyrightNotice';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.TRACK_NAME:
          event.subtype = 'trackName';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.INSTRUMENT_NAME:
          event.subtype = 'instrumentName';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.LYRICS:
          event.subtype = 'lyrics';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.MARKER:
          event.subtype = 'marker';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.CUE_POINT:
          event.subtype = 'cuePoint';
          event.text = stream.read(length);
          return event;

      case MidiMetaCodes.MIDI_CHANNEL_PREFIX:
          event.subtype = 'midiChannelPrefix';
          if (length !== 1)
          {
            throw "Expected length for midiChannelPrefix event is 1, got " + length;
          }
          event.channel = stream.readInt8();
          return event;

      case MidiMetaCodes.END_OF_TRACK:
          event.subtype = 'endOfTrack';
          if (length !== 0)
          {
            throw "Expected length for endOfTrack event is 0, got " + length;
          }
          return event;

      case MidiMetaCodes.SET_TEMPO:
          event.subtype = 'setTempo';
          if (length !== 3)
          {
            throw "Expected length for setTempo event is 3, got " + length;
          }
          event.microsecondsPerBeat = (
              (stream.readInt8() << 16)
              + (stream.readInt8() << 8)
              + stream.readInt8()
          );
          return event;

      case MidiMetaCodes.SMPTE_OFFSET:
          event.subtype = 'smpteOffset';
          if (length !== 5)
          {
            throw "Expected length for smpteOffset event is 5, got " + length;
          }
          const hourByte:number = stream.readInt8();

          // magic
          event.frameRate = {
              0x00: 24, 0x20: 25, 0x40: 29, 0x60: 30
          }[hourByte & 0x60];
          //console.error( event.frameRate );

          event.hour = hourByte & 0x1f;
          event.min = stream.readInt8();
          event.sec = stream.readInt8();
          event.frame = stream.readInt8();
          event.subframe = stream.readInt8();
          return event;

      case MidiMetaCodes.TIME_SIGNATURE:
          event.subtype = 'timeSignature';
          if (length !== 4)
          {
            throw "Expected length for timeSignature event is 4, got " + length;
          }
          event.numerator = stream.readInt8();
          event.denominator = Math.pow(2, stream.readInt8());
          event.metronome = stream.readInt8();
          event.thirtyseconds = stream.readInt8();

          return event;

      case MidiMetaCodes.KEY_SIGNATURE:
          event.subtype = 'keySignature';
          if (length !== 2)
          {
            throw "Expected length for keySignature event is 2, got " + length;
          }
          event.key = stream.readInt8(true);
          event.scale = stream.readInt8();
          return event;

      case MidiMetaCodes.SEQUENCER_SPECIFIC:
          event.subtype = 'sequencerSpecific';
          event.data = stream.read(length);
          return event;

      default:
          // console.log("Unrecognised meta event subtype: " + subtypeByte);
          event.subtype = 'unknown';
          event.data = stream.read(length);
          return event;
      }
  }
}
