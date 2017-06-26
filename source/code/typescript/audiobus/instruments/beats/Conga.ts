/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Basic Percussion Element
Description - The conga is a single oscillator that pitch sweeps when plays
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';

export default class Conga extends Instrument
{
  private osc:OscillatorNode;

		// create
		constructor( audioContext?:AudioContext )
		{
			super( audioContext );
			// Synthesize!
			this.osc = audioContext.createOscillator();
			//this.osc.type = OscillatorTypes.SINE; // sine wave

      // Shape the output waveform
      this.envelope.amplitude = 0.8;
      this.envelope.attackTime = 0.025;
      this.envelope.decayTime = 0.05;
      this.envelope.releaseTime = 0.160;
      this.envelope.sustainVolume = 0.5;
      this.envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;

      this.input = this.osc;
		}

		public start( f:number=1200, offsetA:number=0.160 ):boolean
		{
			const t:number = this.audioContext.currentTime;

			this.osc.frequency.setValueAtTime(f, t);
			this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);
/*
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.5, t);
			this.gain.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + offsetA);
      */
      if ( super.start() )
      {
        this.osc.start(0);
        return true;
      }else{
        return false;
      }
		}
}
