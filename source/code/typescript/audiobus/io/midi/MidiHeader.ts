/*
The header chunk at the beginning of the file specifies some basic information about the data in the file.

Here's the syntax of the complete chunk:
<Header Chunk> = <chunk type><length><format><ntrks><division>

As described above,

<chunk type> is the four ASCII characters 'MThd';

<length> is a 32-bit representation of the number 6 (high byte first).

The data section contains three 16-bit words, stored most-significant byte first.
The first word, <format>, specifies the overall organisation of the file.

Only three values of <format> are specified:

0-the file contains a single multi-channel track
1-the file contains one or more simultaneous tracks (or MIDI outputs) of a sequence
2-the file contains one or more sequentially independent single-track patterns

More information about these formats is provided below.

<ntrks>, is the number of track chunks in the file. It will always be 1 for a format 0 file.

<division>, specifies the meaning of the delta-times.
It has two formats, one for metrical time, and one for time-code-based time:

bit 15  | bits 14 -> 8              | bits 7 -> 0
0       | ticks per quarter-note    | empty
1       | negative SMPTE format     | ticks per frame


If bit 15 of <division> is zero, the bits 14 thru 0 represent the number of delta time "ticks" which make up a
quarter-note. For instance, if division is 96, then a time interval of an eighth-note between two events in the
file would be 48.


If bit 15 of <division> is a one, delta times in a file correspond to subdivisions of a second, in a way
consistent with SMPTE and MIDI Time Code. Bits 14 thru 8 contain one of the four values -24, -25, -29, or
-30, corresponding to the four standard SMPTE and MIDI Time Code formats (-29 corresponds to 30 drop
frame), and represents the number of frames per second. These negative numbers are stored in two's
compliment form. The second byte (stored positive) is the resolution within a frame: typical values may be 4
(MIDI Time Code resolution), 8, 10, 80 (bit resolution), or 100. This stream allows exact specifications of
time-code-based tracks, but also allows millisecond-based tracks by specifying 25 frames/sec and a resolution
of 40 units per frame. If the events in a file are stored with a bit resolution of thirty-frame time code, the
division word would be E250 hex
*/

import MidiStream from './MidiStream';

export default class MidiHeader
{
  public static FORMAT_SINGLE_MULTI_CHANNEL:string = 'single multi-channel track';
  public static FORMAT_MULTIPLE_SIMULTANEOUS:string = 'one or more simultaneous tracks of a sequence';
  public static FORMAT_MULTIPLE_SEQUENTIAL:string = 'one or more sequentially independent single-track patterns';

  public format:number;
  public formatType:string;
  public trackCount:number;
  public ticksPerBeat:number = 4;

  constructor( headerStream:MidiStream )
  {
    // 0 - file contains a single multi-channel track
    // 1 - file contains one or more simultaneous tracks (or MIDI outputs) of a sequence
    // 2 - file contains one or more sequentially independent single-track patterns
    const format:number = headerStream.readInt16();

    // number of track chunks in the file. It will always be 1 for a format 0 file.
    const count:number = headerStream.readInt16();

    // specifies the meaning of the delta-times.
    const timeDivision:number = headerStream.readInt16();

    switch(format)
    {
      case 1:
        this.formatType = MidiHeader.FORMAT_MULTIPLE_SIMULTANEOUS;
        this.trackCount = count;
        break;

      case 2:
        this.formatType = MidiHeader.FORMAT_MULTIPLE_SEQUENTIAL;
        this.trackCount = count;
        break;

      case 0:
      default:
        this.formatType = MidiHeader.FORMAT_SINGLE_MULTI_CHANNEL;
        this.trackCount = 1;//count;
    }
    this.format = format;


    // now determine how the time signatures are handled
    if (timeDivision & 0x8000)
    {
      // Metric Time
      // delta times in a file correspond to subdivisions of a second, in a way
      // consistent with SMPTE and MIDI Time Code.
      // Bits 14 thru 8 contain one of the four values -24, -25, -29, or -30,
      // corresponding to the four standard SMPTE and MIDI Time Code formats
      // (-29 corresponds to 30 drop frame), and represents the number of frames
      // per second. These negative numbers are stored in two's compliment form.
      // The second byte (stored positive) is the resolution within a frame:
      // typical values may be 4 (MIDI Time Code resolution), 8, 10, 80
      // (bit resolution), or 100. This stream allows exact specifications of
      // time-code-based tracks, but also allows millisecond-based tracks by
      // specifying 25 frames/sec and a resolution of 40 units per frame.
      // If the events in a file are stored with a bit resolution of thirty-frame
      // time code, the division word would be E250 hex
      throw "Expressing time division in SMTPE frames is not supported yet";
    }else{
      // Time-Code Time
      // number of delta time "ticks" which make up a quarter-note.
      // For instance, if division is 96, then a time interval of an eighth-note
      // between two events in the file would be 48.
      this.ticksPerBeat = timeDivision; // ticks per quarter-note
    }
  }

  public ticksToSeconds(ticks:number=1):number
  {
  	return 0;//(60 / header.ticksPerBeat) * (ticks / header.PPQ);
  }

  public toString():string
  {
    return "[MidiFileHeader:" + this.trackCount + " tracks]" + this.formatType + " ticksPerBeat:" + this.ticksPerBeat;
  }
}
