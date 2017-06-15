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

export default class MidiTrack implements ITrack
{
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
      return this.bpm;
    }

    constructor( )
    {
      this.tracks = [];
    }

    //
    public getCommandAtPosition( position:number ):Array<ICommand>
    {
      return this.positions[position];
    }
}
