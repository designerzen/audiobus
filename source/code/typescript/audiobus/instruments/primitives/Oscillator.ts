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
  private oscillator:OscillatorNode;
  private oscillatorType:OscillatorType;

  // create ='sine'
  constructor( type:OscillatorType, audioContext:AudioContext=undefined, outputTo:AudioNode=undefined )
  {
  	super( audioContext );
  	this.oscillatorType = type;
    //this.connect( outputTo, this.oscillator );
  }

  public create():void
  {
    super.create();
    
  	// Synthesize!
  	this.oscillator = this.audioContext.createOscillator();
  	//this.oscillator.type = this.oscillatorType;// || OscillatorTypes.SINE;//this.oscillatorType;// || OscillatorTypes.SINE; // default to sine wave
    this.oscillator.frequency.value = 440;

    this.envelope.attackTime = 0.5;
    this.envelope.decayTime = 0.2;
    this.envelope.sustainVolume = 0.9;
    this.envelope.holdTime = -1;
    this.envelope.hold = false;
    this.envelope.releaseTime = 0.7;

    //this.envelope.input = this.oscillator;
    this.input = this.oscillator;
}

public start( frequency:number=-1 ):boolean
{
  console.error("Starting oscillator");
	//
        if ( frequency > -1 )
        {
            this.oscillator.frequency.value = frequency;
        }else{

        }

        // if this is initialising... we need to begin the oscillator!
        if  ( super.start() )
        {
            // this.context.currentTime
            this.oscillator.start( 0 );
            return true;
        }else{
            //this.oscillator.
            return false;
        }
}

    public stop():boolean
    {
      //this.osc.stop();
      return super.stop();
    }

    public note( frequency:number ):boolean
    {
      var time:number = this.context.currentTime + 0.005;
      //this.oscillator.frequency.cancelScheduledValues();
      this.oscillator.frequency.value = frequency;
      //this.oscillator.frequency.setValueAtTime(frequency, time);
//this.oscillator.frequency.linearRampToValueAtTime( frequency, time );
      return this.isPlaying;
    }

}
