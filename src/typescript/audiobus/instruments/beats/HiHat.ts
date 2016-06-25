/// <reference path="../../Dependencies.ts"/>
/// <reference path="Drum.ts" />
/*//////////////////////////////////////////////////////////////////////////////

MIT Licence

Bass Drum
==============
Abstract    - Basic Percussion Element
Description -
Use         - trigge
Methods     -

//////////////////////////////////////////////////////////////////////////////*/
module audiobus.instruments.beats
{
    export class HiHat extends Drum
    {
		private osc5:OscillatorNode;
		private osc6:OscillatorNode;
		private osc7:OscillatorNode;
		private osc8:OscillatorNode;
		private osc9:OscillatorNode;
		private oscA:OscillatorNode;

		public biQuadFilterA:BiquadFilterNode;
		public biQuadFilterB:BiquadFilterNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext );

			// Synthesize!

			//	GENERATE OSCILLATOR 5,6,7,8,9,A (square)
			this.osc5 = audioContext.createOscillator();
			this.osc5.type = OscillatorTypes.SQUARE; // square wave
			this.osc5.frequency.value = 600;

			this.osc6 = audioContext.createOscillator();
			this.osc6.type = OscillatorTypes.SQUARE; // square wave
			this.osc6.frequency.value = 900;

			this.osc7 = audioContext.createOscillator();
			this.osc7.type = OscillatorTypes.SQUARE; // square wave
			this.osc7.frequency.value = 1300;

			this.osc8 = audioContext.createOscillator();
			this.osc8.type = OscillatorTypes.SQUARE; // square wave
			this.osc8.frequency.value = 2000;

			this.osc9 = audioContext.createOscillator();
			this.osc9.type = OscillatorTypes.SQUARE; // square wave
			this.osc9.frequency.value = 2300;

			this.oscA = audioContext.createOscillator();
			this.oscA.type = OscillatorTypes.SQUARE; // square wave
			this.oscA.frequency.value = 2800;

			this.biQuadFilterA = audioContext.createBiquadFilter();
			//this.biQuadFilterA.type = OscillatorTypes.SQUARE; // HP filter
			this.biQuadFilterA.frequency.value = 10000;

			this.biQuadFilterB = audioContext.createBiquadFilter();
			//this.biQuadFilterB.type = OscillatorTypes.SQUARE; // HP filter
			this.biQuadFilterB.frequency.value = 10000;

			this.osc5.connect(this.biQuadFilterA);
			this.osc6.connect(this.biQuadFilterA);
			this.osc7.connect(this.biQuadFilterA);
			this.osc8.connect(this.biQuadFilterA);
			this.osc9.connect(this.biQuadFilterA);
			this.oscA.connect(this.biQuadFilterA);

			this.biQuadFilterA.connect(this.biQuadFilterB);
			this.biQuadFilterB.connect( this.gain );

            this.connect( outputTo, this.biQuadFilterB );
		}

		// TRIGGERS
		public start():boolean
		{
			var t:number = this.context.currentTime;

			// noise gain
			//this.noiseGain.gain.setValueAtTime(0.2, t);
			//this.noiseGain.gain.linearRampToValueAtTime(0,  t + 0.025);

			this.biQuadFilterA.frequency.setValueAtTime(20, t);
			this.biQuadFilterA.frequency.linearRampToValueAtTime(16000, 	t + 0.050);
			this.biQuadFilterB.frequency.setValueAtTime(20, t);
			this.biQuadFilterB.frequency.linearRampToValueAtTime(16000, 	t + 0.050);

            /*
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.4, t);
			this.gain.gain.linearRampToValueAtTime(0.4,  t + 0.025);
			this.gain.gain.exponentialRampToValueAtTime(0.1, 	t + 0.050);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + 0.300);
*/

            var position:number = this.envelope.start();
            if ( super.start() )
            {
                //noise.start(0);
                this.osc5.start(0);
				this.osc6.start(0);
				this.osc7.start(0);
				this.osc8.start(0);
				this.osc9.start(0);
				this.oscA.start(0);
                return true;
            }else{
                return false;
            }
		}

	}
}