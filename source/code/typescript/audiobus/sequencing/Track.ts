/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Midi Track
==============
Abstract    - A Midi Track Model - no logic - just data
Description - Sequences of MidiCommands
Use         - Add MidiCommands
Methods     -
//////////////////////////////////////////////////////////////////////////////*/

import ICommand from '../ICommand';
import ITrack from '../ITrack';

export default class Track implements ITrack
{
    public tracks:Array<ICommand>;
    public positions:object;

    public fileName:string = "";
    public trackName:string = "";
    public meta:string = "";
    public copyrightNotice:string = "";
    public lyrics:string = "";

    // Timing
    public bpm:number = 120;  // default from MIDI spec
    public timeSignature:Array<number> = [4,4];  // default from MIDI spec

    get tempo():number
    {
      // this is a factor of a number of things including header info
      return this.bpm;
    }

    constructor( )
    {
      this.tracks = [];
      this.positions = {};
    }

    // Convert this track into a JSON format
    public toJSON():string
    {
      // https://developers.google.com/web/updates/2015/01/ES6-Template-Strings
      let json:string = `{
        fileName:${this.fileName},
        trackName:${this.trackName},
        meta:${this.meta},
        copyrightNotice:${this.copyrightNotice},
        bpm:${this.bpm},
        timeSignature:${this.timeSignature.toString()},
        tracks:[ ${this.tracks.toString()} ]
      }`;
      // now add the
      return JSON.stringify(json);
    }

    // TODO:
    // Convert a JSON version of a song into this track
    public fromJSON(json:string):void
    {
      let template = JSON.parse(json);
      // loop through all until key tracks is found...
      for (let key in template)
      {
        // check for prototypes... hasOwnProperty()
        const data = template[key];
      }
    }

    //
    public getCommandsAtPosition( position:number ):Array<ICommand>
    {
      return this.positions[position];
    }
}
