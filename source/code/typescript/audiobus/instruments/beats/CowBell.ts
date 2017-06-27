/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';

//
// enum OscillatorTypes {
//   SINE = 'sine',
//   SQUARE = 'square',
//   SAWTOOTH = 'sawtooth',
//   TRIANGLE = 'triangle',
//   CUSTOM = 'custom'
// }


export default class CowBell extends Instrument
{
		private oscB:OscillatorNode;
		private oscC:OscillatorNode;

		// create
		constructor( audioContext?:AudioContext )
		{
			super( audioContext );

			// Synthesize!
			//GENERATE COWBELL
			this.oscB = audioContext.createOscillator();
			this.oscB.type = "square";// OscillatorType["square"];//OscillatorTypes.SQUARE; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = audioContext.createOscillator();
			this.oscC.type = "square";//OscillatorTypes.SQUARE; // square wave
			this.oscC.frequency.value = 1400;

      // we send null to connect as we are handling the
      // source connections manually here
			this.input = this.oscB;
			this.input = this.oscC;

      // Shape the output waveform
      this.envelope.attackTime = 0.025;
      this.envelope.decayTime = 0.05;
      this.envelope.releaseTime = 0.4;
      this.envelope.sustainVolume = 0.2;
      this.envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;

      //this.input = ;
		}

		public start(offsetA:number=0.025, offsetB:number=0.05, offsetC:number=0.4):boolean
		{
      /*
			var t:number = this.context.currentTime;

			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(1, t);
			this.gain.gain.linearRampToValueAtTime( 1,  t + offsetA );
			this.gain.gain.exponentialRampToValueAtTime( 0.2, t + offsetB );
			this.gain.gain.linearRampToValueAtTime( 0.0,  t + offsetC );
      */

      if ( super.start() )
      {
        this.oscB.start(0);
	      this.oscC.start(0);
        return true;
      }else{
        return false;
      }
		}
}
