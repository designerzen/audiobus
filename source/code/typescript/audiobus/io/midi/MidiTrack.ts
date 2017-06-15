/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi Track
==============
Abstract    - A Midi Track Model - no logic - just data
Description - Sequences of MidiCommands
Use         - Add MidiCommands
Methods     -
//////////////////////////////////////////////////////////////////////////////*/

import MidiCommand from './MidiCommand';
import MidiHeader from './MidiHeader';
import ICommand from '../../ICommand';
import ITrack from '../../ITrack';

export default class MidiTrack implements ITrack
{
    public header:MidiHeader;

    public tracks:Array<ICommand>;
    public positions:object = {};

    public fileName:string = "";
    public trackName:string = "";
    public meta:string = "";
    public copyrightNotice:string = "";
    public lyrics:string = "";
    public bpm:number = 120;  // default from MIDI spec
    public timeSignature:Array<number> = [4,4];  // default from MIDI spec

    get tempo():number
    {
      // this is a factor of a number of things including header info
      return this.header ? this.header.ticksPerBeat : -1;
    }

    constructor( header:MidiHeader=undefined )
    {
      if (header)
      {
        this.header = header;
      }
      this.tracks = [];
    }

    private addMetaEvent(event:MidiCommand)
    {
      if (!event.text)
      {
        return;
      }


      switch( event.subtype )
      {
          case "trackName":
            if (this.trackName.length > 1)
            {
              //ableton adds some weird stuff to the track
              this.trackName = event.text.replace(/\u0000/g, '')
            }else{
              // append...
              this.trackName += event.text;
            }
            // also add it to filename if it looks like a file name...
            break;

          case "text":
          case "copyrightNotice":
          case "lyrics":
              if (event.text)
              {
                this[event.subtype] += event.text;
              }
              break;

          default:
              // add
              this.meta += event.text;
      }
    }

    //
    public getCommandAtPosition( position:number ):Array<MidiCommand>
    {
      return this.positions[position];
    }

    // A way of adding an event and multiple events to track
    public addEvent( index:number, event:MidiCommand )
    {
        // check to see if there is an pocket already open
        // open a new pocket
        if (event.type === MidiCommand.TYPE_META)
        {
          this.addMetaEvent(event);
          // add !this.fileName && !event.length && track.name
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
                    //event.deltaTime;
                    //console.log(event.deltaTime);
                    if (!this.positions[event.deltaTime])
                    {
                      this.positions[event.deltaTime] = [event];
                    }else{
                      this.positions[event.deltaTime].push(event);
                    }
                    this.tracks.push(event);
            }
        }
        //console.log(this.positions);
    }
}
