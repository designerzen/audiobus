/*

This class allows you to check the status of whether a key has been pressed
and if so other characteristics

also allows for chords to be created and maintained :)

*/
export default class NoteMatrix
{

  // notes on
  public notes = {};

  constructor()
  {

  }

  public isNoteOn( noteNumber:number ):boolean
  {
    return this.notes[ noteNumber ] === true;
  }
  public isNoteOff( noteNumber:number ):boolean
  {
    // loose inequality...
    return this.notes[ noteNumber ] !== true;
  }

  public chordOn()
  {

  }

  public chordOff()
  {

  }

  // return if it has changed!
  public noteOn( noteNumber:number ):boolean
  {
    const previousValue:boolean = this.notes[ noteNumber ] || false;
    this.notes[ noteNumber ] = true;
    return previousValue !== true;
  }

  public noteOff( noteNumber:number ):boolean
  {
    const previousValue:boolean = this.notes[ noteNumber ] || false;
    this.notes[ noteNumber ] = false;
    return previousValue !== false ;
  }

}
