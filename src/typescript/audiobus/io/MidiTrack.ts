/// <reference path="../Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi Track
==============
Abstract    - Load and decode a .midi file from a server
Description - Buffers a .midi file into memory, parse the commands
Use         - Load( file.midi, onComplete ) and wait for the callback
Methods     -
Forked from - https://github.com/gasman/jasmid/blob/master/stream.js#L2
//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiHeader
    {
        public formatType:number;
        public trackCount:number;
        public ticksPerBeat:number;
    }


    export class MidiFileEvent
    {
        public deltaTime:number;
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
    }

    export class MidiTrack
    {
        public header:MidiHeader;
        public tracks:Array<MidiFileEvent>;

        constructor( header:MidiHeader )
        {

        }


        public decode( stream:MidiStream )
        {
            var header = this.decodeHeader( stream );
            var tracks = this.decodeTracks( stream );
        }

    }
}