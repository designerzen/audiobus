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

export default class BassDrum extends Instrument
{
		protected bass:OscillatorNode;

		public compressor:DynamicsCompressorNode;
		public biquadFilter:BiquadFilterNode;

		// create
		constructor( audioContext?:AudioContext )
		{
			super( audioContext );

      // Create a compressor node
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      //compressor.reduction.value = -20;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;
      this.compressor = compressor;

      const biquadFilter= audioContext.createBiquadFilter();
      biquadFilter.type = "lowshelf";
      biquadFilter.frequency.value = 100;
      biquadFilter.gain.value = 5;
      this.biquadFilter = biquadFilter;

			// Synthesize!
			//this.bass = this.createOscillator();
			//this.bass.type = "sine";

      // Shape the output waveform
			const envelope = this.envelope;
      envelope.gain = 8;
      envelope.attackTime = 0.002;
      envelope.decayTime = 0.05;
      envelope.holdTime = 0;
      envelope.hold = false;
      envelope.releaseTime = 0.3;
      envelope.sustainVolume = 0.8;

      // Connect these bits and pieces together
      compressor.connect(biquadFilter);
			// osciallator fits between...
			this.input = biquadFilter;
    };

		protected createOscillator( frequency:number=440, type?:string ):OscillatorNode
		{
			// Synthesize!
			const oscillator = this.audioContext.createOscillator();
			//this.oscillator.type = this.oscillatorType;// || OscillatorTypes.SINE;//this.oscillatorType;// || OscillatorTypes.SINE; // default to sine wave
			oscillator.frequency.value = frequency;
			// connect!
			oscillator.connect(this.compressor);
			this.bass = oscillator;
			return oscillator;
		}

		protected destroyOscillator( time:number=0 ):void
		{
			this.bass.stop( time ); //  transactionTime
			this.bass.disconnect( this.compressor );
			this.bass = null;
		}

		// trigger!
		public start( startFrequency:number=750, endFrequency:number=80, length:number=0.005 ):boolean
		{
			const wasPlaying:boolean = super.start();
      const t:number = this.context.currentTime;
			// time in this context must be sent to the envelope if it is deffered...
			//if  ( !wasPlaying )
			if  ( !wasPlaying )
			{
				this.createOscillator( endFrequency );

				// start from zero in bassdrum!
				this.bass.frequency.setValueAtTime( startFrequency, 0 );
				this.bass.frequency.exponentialRampToValueAtTime( endFrequency, length );

				this.bass.start( 0 ); // this.context.currentTime
				return true;
			}else{
				// else just modify the existing osciallator
				this.bass.frequency.cancelScheduledValues(t);
				this.bass.frequency.setValueAtTime( startFrequency, t );
				this.bass.frequency.exponentialRampToValueAtTime( endFrequency, t+length );

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
	    console.error("Stopping oscillator",this.bass);

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
	}
