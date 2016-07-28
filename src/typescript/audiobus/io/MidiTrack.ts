/// <reference path="../Dependencies.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi Track
==============
Abstract    - A Midi Track Model - no logic - just data
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

    export class MidiCommand
    {
        // Commands!
        public static TYPE_CHANNEL:string = 'channel';
        public static TYPE_META:string = 'meta';
        
        public static COMMAND_NOTE_OFF:string = 'noteOff';
        public static COMMAND_NOTE_ON:string = 'noteOn';
        public static COMMAND_NOTE_AFTER_TOUCH:string = 'noteAftertouch';
        public static COMMAND_CONTROLLER:string = 'controller';
        public static COMMAND_PROGRAM_CHANGE:string = 'programChange';
        public static COMMAND_CHANNEL_AFTEER_TOUCH:string = 'channelAftertouch';
        public static COMMAND_PITCH_BEND:string = 'pitchBend';

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
    }

    export class MidiTrack
    {
        public header:MidiHeader;
        public tracks:Array<MidiCommand>;

        public trackName:string = "";
        public meta:string = "";
        public copyrightNotice:string = "";
        public lyrics:string = "";

        constructor( header:MidiHeader )
        {
            this.header = header;
        }

        // A way of adding an event and multiple events to track
        public addEvent( index:number, event:MidiCommand )
        {
            // check to see if there is an pocket already open
            // open a new pocket
            if (event.type === "meta")
            {
                switch( event.subtype )
                {
                    case "text":
                    case "trackName":
                    case "copyrightNotice":
                    case "lyrics":
                        this[event.subtype] += event.text;
                        break;

                    default:
                        // add
                }
            }else{
                switch( event.subtype )
                {
                    case MidiCommand.COMMAND_NOTE_ON:
                    case MidiCommand.COMMAND_NOTE_OFF:
                    case MidiCommand.COMMAND_CONTROLLER:
                    case MidiCommand.COMMAND_PITCH_BEND:
                    case MidiCommand.COMMAND_PROGRAM_CHANGE:
                    case MidiCommand.COMMAND_CHANNEL_AFTEER_TOUCH:
                    default:
                        // add
                }
            }

        }
    }
}