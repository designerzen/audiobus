/*

This is a way to control multiple note matrices for channels...

*/

import NoteMatrix from './NoteMatrix';
import ICommand from './ICommand';
import Command from './Command';

export default class PolyphonicMatrix
{
  // there are 12 possible channels...
  public channels:Array<NoteMatrix> = [];

  // PMEMode means do we rotate channels?
  constructor( quantityOfChannels:number=12, PMEMode:boolean=false )
  {
    for ( let c=0, l=quantityOfChannels; c<l; ++c )
    {
      this.channels.push( new NoteMatrix() );
    }
  }

  public chordOn()
  {

  }

  public chordOff()
  {

  }
  public isNoteOn( noteNumber:number, channel:number ):boolean
  {
    const matrix:NoteMatrix = this.channels[ channel ];
    return matrix.isNoteOn( noteNumber );
  }
  public isNoteOff( noteNumber:number, channel:number ):boolean
  {
    const matrix:NoteMatrix = this.channels[ channel ];
    // loose inequality...
    return matrix.isNoteOff( noteNumber );
  }

  // return if it has changed!
  public noteOn( noteNumber:number, channel:number ):boolean
  {
    // first we fetch the channel...
    const matrix:NoteMatrix = this.channels[ channel ];
    // // if this doesn't exist, throw an error...
    // if (!matrix)
    // {
    //   throw Error("ICommand specified for channel "+channel+" does not have a correspoding matrix");
    // }
    const previousValue:boolean = matrix.noteOn( noteNumber );
    return previousValue;
  }

  public noteOff( noteNumber:number, channel:number ):boolean
  {
    const matrix:NoteMatrix = this.channels[ channel ];
    const previousValue:boolean = matrix.noteOff( noteNumber );
    return previousValue;
  }
  //
  // // always returns the matching voice with this notenumber
  // public command( command:ICommand, instrument:Instrument ):Instrument
  // {
  //   // first we fetch the channel...
  //   const channel:number = command.channel;
  //   const noteNumber:number = command.noteNumber;
  //
  //   // first let us fetch our matrix...
  //   let matrix:NoteMatrix = this.channels[ channel ];
  //   // if this doesn't exist, throw an error...
  //   if (!matrix)
  //   {
  //     throw Error("ICommand specified for channel "+channel+" does not have a correspoding matrix");
  //   }
  //
  //   // so now we know our channel and our matrix exists, we can check the command type...
  //   // and deal with creation!
  //   switch(command.subtype)
  //   {
  //     case Command.COMMAND_NOTE_OFF:
  //       const wasStoppedBefore:boolean = matrix.noteOff( noteNumber );
  //       // turn instrument off...
  //       instrument.stop();
  //       break;
  //
  //     case Command.COMMAND_NOTE_ON:
  //       // check to see if we have the instrument in our bank...
  //       const wasPlayingBefore:boolean = matrix.noteOn( noteNumber );
  //       const pitch:number = Scales.frequencyFromNoteNumber(command.noteNumber);
  //       if (wasPlayingBefore)
  //       {
  //         // this is a continuation of a previous note
  //         // change pitch without envelope
  //         instrument.start( pitch );
  //       }else{
  //         instrument.start( pitch );
  //       }
  //       break;
  //
  //     // case Command.COMMAND_NOTE_AFTER_TOUCH:
  //     //   break;
  //     // case Command.COMMAND_CONTROLLER:
  //     //   break;
  //
  //     // Instrument change!!!
  //     case Command.COMMAND_PROGRAM_CHANGE:
  //       break;
  //
  //     // case Command.COMMAND_CHANNEL_AFTER_TOUCH:
  //     //   break;
  //     // case Command.COMMAND_CHANNEL_PRESSURE:
  //     //   break;
  //     //
  //     // case Command.COMMAND_PITCH_BEND:
  //     //   break;
  //     //
  //     // case Command.COMMAND_SYSTEM_MESSAGE:
  //     //   break;
  //   }
  //
  //   //
  //   // const previousValue:boolean = this.voices[ noteNumber ] || false;
  //   // this.voices[ noteNumber ] = true;
  //   // return previousValue != true;
  //   return null;
  // }

}
