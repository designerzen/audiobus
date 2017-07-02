/*

This is a way to create a constant pool of new and old instruments that are created
and disposed of as needed...

*/

import NoteMatrix from './NoteMatrix';
import PolyphonicMatrix from './PolyphonicMatrix';
import ICommand from './ICommand';
import Command from './Command';
import Instrument from './instruments/Instrument';
import Scales from './scales/Scales';

export default class VoiceFactory
{
  protected context:AudioContext;

  // there are 12 possible channels...
  public channels:PolyphonicMatrix;
  public instruments:object;//}:Array<Instrument>;
  public voices:Array<Instrument>;

  // PMEMode means do we rotate channels?
  constructor( audioContext:AudioContext, quantityOfChannels:number=12 )
  {
    this.context = audioContext;
    this.channels = new PolyphonicMatrix(quantityOfChannels);
    this.instruments = {};
    this.voices = [];
  }

  public chordOn()
  {

  }

  public chordOff()
  {

  }

  public getFreeInstruments():Array<Instrument>
  {
    const instruments:Array<Instrument> = [];
    this.voices.forEach( (instrument:Instrument )=>{
      if (instrument.hasFinished)
      {
        instruments.push(instrument);
      }
    })
    return instruments;
  }

  // This creates a new instrument if one does not exist...
  private factory<I extends Instrument>( noteNumber:number, InstrumentClass: new (audioContext?:AudioContext) => I ):I
  {
    const freeInstruments:Array<Instrument> = this.getFreeInstruments();
    let instrument:I;// Instrument;
    console.error("VoiceFactory factory looking for free instruments... "+freeInstruments );
    if (freeInstruments.length)
    {
      instrument = <I>freeInstruments[0] ;
      console.error("VoiceFactory factory looking for free instrument found recycle?", instrument);
      return instrument;

    }else{
      instrument = new InstrumentClass( this.context );
      // save in our cache...
      this.instruments[ noteNumber] = instrument;
      this.voices.push( instrument );
    }

    return instrument;
  }

  //////////////////////////////////////////////////////////////////////////////
  // check to see if there is already a note playing on this channel...
  //////////////////////////////////////////////////////////////////////////////
  public noteOn<I extends Instrument>( noteNumber:number, channel:number, InstrumentClass: new (audioContext?:AudioContext) => I ):I
  {
    const wasPlaying:boolean = this.channels.noteOn( noteNumber, channel );
    const existing = this.instruments[ noteNumber ];
    if (existing && wasPlaying)
    {
      // if this note was playing before, that means we already have an instance of
      // the InstrumentClass in memory, playing in this note :)
      console.error("VoiceFactory:noteOn("+noteNumber+":"+channel+") - found existing", existing, "hasFinished:"+existing.hasFinished );
      return existing
    }else{
      // if not, we need to create a new instance and save that somewhere safe
      const instrument:I = this.factory(noteNumber, InstrumentClass);
      console.error("VoiceFactory:noteOn("+noteNumber+":"+channel+") - creating new", instrument);
      return instrument;
    }
  }

  public noteOff<I extends Instrument>( noteNumber:number, channel:number, InstrumentClass: new (audioContext?:AudioContext) => I ):I
  {
    const wasPlaying:boolean = this.channels.noteOff( noteNumber, channel );
    const existing = this.instruments[ noteNumber ];
    if (existing && wasPlaying)
    {
      const instrument:I = this.instruments[ noteNumber ];
      //delete this.instruments[ noteNumber ];
      console.error("VoiceFactory:noteOff("+noteNumber+":"+channel+") - found",instrument);
      return instrument;
    }else{
      console.error("VoiceFactory:noteOff("+noteNumber+":"+channel+") - nothing to stop", this.instruments[ noteNumber ]);
      return null;
    }

  }

  // this manufactures the specified class with the paramters
  //
  public fetchInstrument<I extends Instrument>( InstrumentClass: new (audioContext?:AudioContext) => I, instrumentName:string ):I
  {
    // check to see if we have a cached instrument of this class...
    // how do we cache a class type???

    // sneaky!
    console.error( "I.constructor", InstrumentClass.constructor );

    let instrument:I = this.instruments[instrumentName];
    let context:AudioContext = this.context;
    // check to see if one exists...
    if ( instrument )
    {
      // now check to see if this instrument of the correct type is currently playing...
      if (instrument.hasFinished)
      {
        // recycle :)
        console.error("VoiceFactory:fetchInstrument:recycle:", instrument.toString() );
      }else{
        // better spawn a new one so it doesn't crash with the one playing...
        instrument = new InstrumentClass( context );
        // and overwrite the pointer to the existing one so it can be garbage collected when it is finished...
        this.instruments[instrument.name] = instrument;
        console.error("VoiceFactory:fetchInstrument:overwrite:", instrument.toString() );
      }


    } else{
      instrument = new InstrumentClass();
      console.error("VoiceFactory:fetchInstrument:fresh:", instrument.toString() );
      // now cache this new instance for next time!
      this.instruments[instrument.name] = instrument;
    }
    return instrument;
  }

  // always returns the matching voice with this notenumber
  public command( command:ICommand, instrument:Instrument ):Instrument
  {
    // first we fetch the channel...
    const channel:number = command.channel;
    const noteNumber:number = command.noteNumber;

    // first let us fetch our matrix...
    let matrix:NoteMatrix = this.channels[ channel ];
    // if this doesn't exist, throw an error...
    if (!matrix)
    {
      throw Error("ICommand specified for channel "+channel+" does not have a correspoding matrix");
    }

    // so now we know our channel and our matrix exists, we can check the command type...
    // and deal with creation!
    switch(command.subtype)
    {
      case Command.COMMAND_NOTE_OFF:
        const wasStoppedBefore:boolean = matrix.noteOff( noteNumber );
        // turn instrument off...
        instrument.stop();
        break;

      case Command.COMMAND_NOTE_ON:
        // check to see if we have the instrument in our bank...
        const wasPlayingBefore:boolean = matrix.noteOn( noteNumber );
        const pitch:number = Scales.frequencyFromNoteNumber(command.noteNumber);
        if (wasPlayingBefore)
        {
          // this is a continuation of a previous note
          // change pitch without envelope
          instrument.start( pitch );
        }else{
          instrument.start( pitch );
        }
        break;

      // case Command.COMMAND_NOTE_AFTER_TOUCH:
      //   break;
      // case Command.COMMAND_CONTROLLER:
      //   break;

      // Instrument change!!!
      case Command.COMMAND_PROGRAM_CHANGE:
        break;

      // case Command.COMMAND_CHANNEL_AFTER_TOUCH:
      //   break;
      // case Command.COMMAND_CHANNEL_PRESSURE:
      //   break;
      //
      // case Command.COMMAND_PITCH_BEND:
      //   break;
      //
      // case Command.COMMAND_SYSTEM_MESSAGE:
      //   break;
    }

    //
    // const previousValue:boolean = this.voices[ noteNumber ] || false;
    // this.voices[ noteNumber ] = true;
    // return previousValue != true;
    return null;
  }

}
