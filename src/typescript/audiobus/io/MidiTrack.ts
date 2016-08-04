/// <reference path="../Dependencies.ts"/>
/// <reference path="./MidiCommand.ts"/>
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi Track
==============
Abstract    - A Midi Track Model - no logic - just data
Description - Sequences of MidiCommands
Use         - Add MidiCommands
Methods     -
//////////////////////////////////////////////////////////////////////////////*/
module audiobus.io
{
    export class MidiHeader
    {
        public formatType:number;
        public trackCount:number;
        public ticksPerBeat:number;
    }

    export class MidiTrack
    {
        public header:MidiHeader;
        public tracks:Array<MidiCommand>;

        public trackName:string = "";
        public meta:string = "";
        public copyrightNotice:string = "";
        public lyrics:string = "";

        constructor( header:MidiHeader=null )
        {
            if (header) this.header = header;
        }

        // A way of adding an event and multiple events to track
        public addEvent( index:number, event:MidiCommand )
        {
            // check to see if there is an pocket already open
            // open a new pocket
            if (event.type === MidiCommand.TYPE_META)
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
                        this.meta += event.text;
                }
            }else{
                switch( event.subtype )
                {
                    case MidiCommand.COMMAND_NOTE_ON:
                    case MidiCommand.COMMAND_NOTE_OFF:
                    case MidiCommand.COMMAND_CONTROLLER:
                    case MidiCommand.COMMAND_PITCH_BEND:
                    case MidiCommand.COMMAND_PROGRAM_CHANGE:
                    case MidiCommand.COMMAND_CHANNEL_AFTER_TOUCH:
                    default:
                        // add
                        event.deltaTime;
                        this.tracks.push(event);
                }
            }

        }
    }
}