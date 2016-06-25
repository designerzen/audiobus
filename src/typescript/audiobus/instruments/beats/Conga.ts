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
    export class Conga extends Drum
    {
		private osc:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext );
			// Synthesize!
			this.osc = audioContext.createOscillator();
			this.osc.type = OscillatorTypes.SINE; // sine wave

            // Shape the output waveform
            this.envelope.amplitude = 0.8;
            this.envelope.attackTime = 0.025;
            this.envelope.decayTime = 0.05;
            this.envelope.releaseTime = 0.160;
            this.envelope.sustainVolume = 0.5;

            this.connect( outputTo, this.osc );
		}

		public start(  f:number=1200, offsetA:number=0.160 ):boolean
		{
			var t:number = this.context.currentTime;

			this.osc.frequency.setValueAtTime(f, t);
			this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);

            /*
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.5, t);
			this.gain.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + offsetA);
            */
            var position:number = this.envelope.start();
            if ( super.start() )
            {
                this.osc.start(0);
                return true;
            }else{
                return false;
            }
		}
	}

}