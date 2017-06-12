/// <reference path="../../Dependencies.ts"/>
/// <reference path="Drum.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Tom Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigger
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.beats
{
    export class Tom extends Drum implements ISoundControl
    {
		private bass:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:AudioNode )
		{
			super( audioContext );

            // Synthesize!
			this.bass = audioContext.createOscillator();
			this.bass.type = OscillatorTypes.SINE; // sine wave

            // Create a compressor node
            var compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -50;
            compressor.knee.value = 40;
            compressor.ratio.value = 12;
            compressor.reduction.value = -2;
            compressor.attack.value = 0;
            compressor.release.value = 0.25;

            var biquadFilter= audioContext.createBiquadFilter();
            biquadFilter.type = "lowshelf";
            biquadFilter.frequency.value = 100;
            biquadFilter.gain.value = 5;

            this.bass.connect(compressor);
            compressor.connect(biquadFilter);

            // Shape the output waveform
            this.envelope.gain = 4;
            this.envelope.attackTime = 0.1;
            this.envelope.decayTime = 0.2;
            this.envelope.holdTime = 0;
            this.envelope.hold = false;
            this.envelope.releaseTime = 0.9;
            this.envelope.sustainVolume = 0.8;

            // Connect these bits and pieces together
            this.connect( outputTo, biquadFilter);
        };

		// trigger!
		public start( startFrequency:number=65, endFrequency:number=55 ):boolean
		{
            var t:number = this.context.currentTime;
            var d:number = this.envelope.duration - this.envelope.attackTime;

            this.bass.frequency.setValueAtTime( 0, t );
            this.bass.frequency.exponentialRampToValueAtTime( startFrequency, t + this.envelope.attackTime);
            this.bass.frequency.setValueAtTime( startFrequency, t + this.envelope.attackTime );

			this.bass.frequency.linearRampToValueAtTime( endFrequency, t + d);
            this.bass.frequency.setValueAtTime( endFrequency, t + d );

			if ( super.start() )
            {
                // always start it from 0 as sine waves otherwise will click
                this.bass.start(0);
                return true;
            }else{
                return false;
            }

		}
	}

}