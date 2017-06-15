/*
To any file system, a MIDI File is simply a series of 8-bit bytes or chunks...

MIDI Files are made up of -chunks-

Each chunk has a 4-character type and a 32-bit length, which is the number of
bytes in the chunk. This structure allows future chunk types to be designed
which may be easily be ignored if encountered by a program written before the
chunk type is introduced.

Your programs should EXPECT alien chunks and treat them as if they weren't there.

Each chunk begins with a 4-character ASCII type.

It is followed by a 32-bit length, most significant byte first
(eg. a length of 6 is stored as 00 00 00 06).

This length refers to the number of bytes of data which follow: the eight bytes
of type and length are not included. Therefore, a chunk with a length of 6 would
actually occupy 14 bytes in the disk file.

Footnote :

This chunk architecture is similar to that used by Electronic Arts' IFF format,
and the chunks described herein could easily be placed in an IFF file.

The MIDI File itself is not an IFF file: it contains no nested chunks, and
chunks are not constrained to be an even number of bytes long.
Converting it to an IFF file is as easy as padding odd length chunks,
 and sticking the whole thing inside a FORM chunk!
*/
import MidiStream from './MidiStream';

export default class MidiChunk
{
  public static TYPE_TRACK:string = "MTrk";
  public static TYPE_HEADER:string = "MThd";

  public id:string;
  public length:number;
  public data:string;

  constructor( stream:MidiStream )
  {
    // Each midi event message is 4 bytes big...
    // either TYPE_TRACK or TYPE_HEADER
    this.id = stream.read(4);

    // 32-bit length, most significant byte first (eg. a length of 6 is stored as 00 00 00 06)
    // number of bytes of data which follow: the eight bytes of type and length
    // are not included. Therefore, a chunk with a length of 6 would actually
    // occupy 14 bytes
    this.length = stream.readInt32();

    // contains three 16-bit words, stored most-significant byte first
    // we use the length discovered from the previous byte to know how long to nibble
    this.data = stream.read(this.length); // data is a hex code in the format 000000
  }
}
