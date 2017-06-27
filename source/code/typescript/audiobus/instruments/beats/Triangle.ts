/*//////////////////////////////////////////////////////////////////////////////

Triangle
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
import Instrument from '../Instrument';
import Envelope from '../../envelopes/Envelope';
import Noise from '../../synthesis/Noise';

export default class Triangle extends Instrument
{
		private osc5:OscillatorNode;
		private osc6:OscillatorNode;
		private osc7:OscillatorNode;
		private osc8:OscillatorNode;
		private osc9:OscillatorNode;
		private oscA:OscillatorNode;

		private noise:AudioBufferSourceNode;
		private noiseBuffer:AudioBuffer;

		public hiPassFilter:BiquadFilterNode;
		public biQuadFilterB:BiquadFilterNode;

		private ready:boolean = false;

		// create
		constructor( audioContext?:AudioContext )
		{
			super( audioContext );

			this.hiPassFilter = audioContext.createBiquadFilter();
			this.hiPassFilter.type = 'highpass'; // HP filter
			this.hiPassFilter.gain.value = 12;
			this.hiPassFilter.frequency.value = 2300;

			this.biQuadFilterB = audioContext.createBiquadFilter();
			//this.biQuadFilterB.type = OscillatorTypes.SQUARE; // HP filter
			this.biQuadFilterB.frequency.value = 200;
			this.biQuadFilterB.gain.value = 9;
			this.biQuadFilterB.type = "peaking";

			const envelope = this.envelope;
      envelope.gain = 3;
			envelope.amplitude = 0.4;
      envelope.attackTime = 0.002;
      envelope.decayTime = 0.005;
      envelope.holdTime = 0.1;
      envelope.hold = false;
      envelope.releaseTime = 0.1;
      envelope.sustainVolume = 0.2;
			envelope.decayType = Envelope.CURVE_TYPE_EXPONENTIAL;

			this.hiPassFilter.connect( this.biQuadFilterB);
      this.input = this.biQuadFilterB;
		}

		protected createOscillators( lowFrequency:number=600, highFrequency:number=2800 ):void
		{
			// // Synthesize!

			// 6 oscillators should help...
			const range:number = highFrequency - lowFrequency;
			const linear:number = range / 6;
			//const type:string = "triangle";//"square";
			//	GENERATE OSCILLATOR 5,6,7,8,9,A (square)
			this.osc5 = this.audioContext.createOscillator();
			this.osc5.type = "triangle";// OscillatorTypes.SQUARE; // square wave
			this.osc5.frequency.value = lowFrequency + linear*1;

			this.osc6 = this.audioContext.createOscillator();
			this.osc6.type = "square";//OscillatorTypes.SQUARE; // square wave
			this.osc6.frequency.value = lowFrequency + linear*2;

			this.osc7 = this.audioContext.createOscillator();
			this.osc7.type = "triangle";//OscillatorTypes.SQUARE; // square wave
			this.osc7.frequency.value = lowFrequency + linear*3;

			this.osc8 = this.audioContext.createOscillator();
			this.osc8.type = "square";// OscillatorTypes.SQUARE; // square wave
			this.osc8.frequency.value = lowFrequency + linear*4;

			this.osc9 = this.audioContext.createOscillator();
			this.osc9.type = "triangle";//OscillatorTypes.SQUARE; // square wave
			this.osc9.frequency.value = lowFrequency + linear*5;

			this.oscA = this.audioContext.createOscillator();
			this.oscA.type = "square";//OscillatorTypes.SQUARE; // square wave
			this.oscA.frequency.value = highFrequency;

			this.noise = this.audioContext.createBufferSource();
			this.noise.loop = true;
			this.noise.buffer = Noise.white( 1, this.audioContext.sampleRate );

			this.osc5.connect(this.hiPassFilter);
			this.osc6.connect(this.hiPassFilter);
			this.osc7.connect(this.hiPassFilter);
			this.osc8.connect(this.hiPassFilter);
			this.osc9.connect(this.hiPassFilter);
			this.oscA.connect(this.hiPassFilter);
			// skip one biquad
			//this.noise.connect( this.biQuadFilterB);

			this.ready = true;
		}

		protected destroyOscillators( time:number=0 ):void
		{
			// this.bass.stop( time ); //  transactionTime
			// this.bass.disconnect( this.compressor );
			// this.bass = null;
			this.osc5.disconnect(this.hiPassFilter);
			this.osc6.disconnect(this.hiPassFilter);
			this.osc7.disconnect(this.hiPassFilter);
			this.osc8.disconnect(this.hiPassFilter);
			this.osc9.disconnect(this.hiPassFilter);
			this.oscA.disconnect(this.hiPassFilter);
			//this.noise.disconnect(this.biQuadFilterB);

			this.osc5.stop( 0 ); //  transactionTime
			this.osc6.stop( 0 ); //  transactionTime
			this.osc7.stop( 0 ); //  transactionTime
			this.osc8.stop( 0 ); //  transactionTime
			this.osc9.stop( 0 ); //  transactionTime
			this.oscA.stop( 0 );
			this.noise.stop( 0 );

			this.osc5 = null;
			this.osc6 = null;
			this.osc7 = null;
			this.osc8 = null;
			this.osc9 = null;
			this.oscA = null;
			this.noise = null;

			this.ready = false;
			console.error("destroying oscillators",this)
		}

		// TRIGGERS
		public start( lowFrequency:number=1200, highFrequency:number=4400, bump:number=0 ):boolean
		{
			const wasPlaying:boolean = super.start();
      const t:number = this.audioContext.currentTime;

			// noise gain
			//this.noiseGain.gain.setValueAtTime(0.2, t);
			//this.noiseGain.gain.linearRampToValueAtTime(0,  t + 0.025);
			const envelopeEndsAt:number = this.envelope.duration + t;
			this.hiPassFilter.frequency.setValueAtTime(highFrequency, t);
			this.hiPassFilter.frequency.linearRampToValueAtTime(lowFrequency, envelopeEndsAt);

			this.biQuadFilterB.frequency.setValueAtTime(highFrequency, t);
			this.biQuadFilterB.frequency.linearRampToValueAtTime(lowFrequency, envelopeEndsAt);

      if ( wasPlaying )
      {
        //noise.start(0);
        // if (this.ready)
				// {
				 //	this.destroyOscillators( 0 );
				// }
				this.destroyOscillators( 0 );

        //return true;
      }else{
				// modify existing oscillators...
				// this.osc5.start(0);
				// this.osc6.start(0);
				// this.osc7.start(0);
				// this.osc8.start(0);
				// this.osc9.start(0);
				// this.oscA.start(0);
          //return false;

      }
			this.createOscillators( lowFrequency, highFrequency );
			this.osc5.start(0);
			this.osc6.start(0);
			this.osc7.start(0);
			this.osc8.start(0);
			this.osc9.start(0);
			this.oscA.start(0);
			this.noise.start(0);
			return wasPlaying;
		}

		public stop( time?:number ):boolean
	  {
			const result:boolean = super.stop();
	    if (!result)
	    {
	      // not started!
	      console.error("ERROR Stopping hihat failed");
	      return false;
	    }
	    console.error("Stopping hihat");

	    const envelopeDuration:number = this.envelope.duration;
	    const transactionTime:number = ( time || this.audioContext.currentTime ) + envelopeDuration + 0.005;  // bit of breathing space
	    // here we work out how long the envelope is going to take as of now
	    // and we schedule the oscillator to stop at will!
	    // this.oscillator.onended = ( e ) => {
	    //   console.error("Osciallator ended...", e);
	    // };
	    this.destroyOscillators( 0 );
	    //this.destroyOscillator( transactionTime );

	    // return bool
	    return result;
		}

}
