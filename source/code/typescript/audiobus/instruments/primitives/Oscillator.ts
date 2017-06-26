/*//////////////////////////////////////////////////////////////////////////////

Oscillator
==============
Abstract    - The base for audio generation, an oscillating wave
Description -
Use         - Set the type and use raw or layer multiple waves together
Methods     -

//////////////////////////////////////////////////////////////////////////////*/

import OscillatorTypes from '../OscillatorTypes'; // handy reference :P
import Instrument from '../Instrument';
//
// enum OscillatorTypes {
//    SINE = 0, //'sine'
//    SQUARE = 1,//'square',
//    SAWTOOTH = 2,//'sawtooth',
//    TRIANGLE = 3,//'triangle',
//    CUSTOM = 4,//'custom'
// }
//
// enum OscillatorType {
//   'sine',
//   'square',
//   'sawtooth',
//   'triangle',
//   'custom'
// }

export default class Oscillator extends Instrument
{
  public static NAME:string = "Oscillator";

  private oscillator:OscillatorNode;
  private oscillatorType:OscillatorType;

  // create a new oscillator every time or re-use the old one?
  // does affect the type of sound output...
  protected reuse:boolean = false;

  public get frequency():number
  {
    return this.oscillator ? this.oscillator.frequency.value : -1;
  }

  public set frequency( value:number )
  {
    //const time:number = this.context.currentTime + 0.005;
    //this.oscillator.frequency.cancelScheduledValues();
    this.oscillator.frequency.value = value;
  }

  constructor( audioContext?:AudioContext )
  {
  	super( audioContext );
    this.name = Oscillator.NAME;
  }

  public create():void
  {
    super.create();

  	//this.createOscillator();

    // this.envelope.attackTime = 0.5;
    // this.envelope.decayTime = 0.2;
    // this.envelope.sustainVolume = 0.9;
    // this.envelope.holdTime = -1;
    // this.envelope.hold = false;
    // this.envelope.releaseTime = 0.7;
    this.envelope.gain = 4;
    this.envelope.attackTime = 0.02;
    this.envelope.decayTime = 0.2;
    this.envelope.holdTime = 0;
    this.envelope.hold = false;
    this.envelope.releaseTime = 0.7;
    this.envelope.sustainVolume = 0.9;
  }

  protected createOscillator( frequency:number=440, type?:string ):void
  {
    // Synthesize!
    this.oscillator = this.audioContext.createOscillator();
    //this.oscillator.type = this.oscillatorType;// || OscillatorTypes.SINE;//this.oscillatorType;// || OscillatorTypes.SINE; // default to sine wave
    this.frequency = frequency;

    // connect!
    //this.envelope.input = this.oscillator;
    this.input = this.oscillator;
  }

  protected destroyOscillator( time:number=0 ):void
  {
    this.oscillator.stop( time ); //  transactionTime

    // disconnect...
    // only destroy when ready...
    //this.oscillator.disconnect( this.envelope.output );
    //this.oscillator = null;
    this.input = null;
    this.oscillator = null;
  }

  public start( frequency:number=440 ):boolean
  {
    // always start the envelope first!
    const wasPlaying:boolean = super.start();
  	//
    console.error("Starting oscillator", !wasPlaying);

    // if this is initialising... we need to begin the oscillator!
    if  ( !wasPlaying )
    {
      this.createOscillator( frequency );

      //this.oscillator.frequency.value = frequency;
        this.oscillator.start( this.context.currentTime ); // this.context.currentTime
        return true;
    }else{
        this.frequency = frequency;
        return false;
    }
  }

  public stop( time?:number ):boolean
  {
    const result:boolean = super.stop();
    if (!result)
    {
      // not started!
      console.error("ERROR Stopping oscillator failed");
      return false;
    }
    console.error("Stopping oscillator",this.oscillator);

    const envelopeDuration:number = this.envelope.duration;
    const transactionTime:number = ( time || this.audioContext.currentTime ) + envelopeDuration + 0.005;  // bit of breathing space
    // here we work out how long the envelope is going to take as of now
    // and we schedule the oscillator to stop at will!
    // this.oscillator.onended = ( e ) => {
    //   console.error("Osciallator ended...", e);
    // };
    this.destroyOscillator( 0 );
    //this.destroyOscillator( transactionTime );

    // return bool
    return result;
  }

  public note( frequency:number ):boolean
  {
    //var time:number = this.context.currentTime + 0.005;
    //this.oscillator.frequency.cancelScheduledValues();
    this.frequency = frequency;
    //this.oscillator.frequency.setValueAtTime(frequency, time);
//this.oscillator.frequency.linearRampToValueAtTime( frequency, time );
    return this.isPlaying;
  }

  public toString():string
	{
		return "Oscillator:" + super.toString();
	}

}
