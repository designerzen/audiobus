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
    export class BassDrum extends Drum implements ISoundControl
    {
		private bass:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:AudioNode )
		{
			super( audioContext );

            // Synthesize!
			this.bass = audioContext.createOscillator();
			this.bass.type = OscillatorTypes.SINE; // sine wave

            // Shape the output waveform
            this.envelope.attackTime = 0.01;
            this.envelope.decayTime = 0.1;
            this.envelope.holdTime = 0;
            this.envelope.hold = false;
            this.envelope.releaseTime = 0.7;
            this.envelope.sustainVolume = 0.95;

            // Connect these bits and pieces together
            this.connect( outputTo, this.bass );
		}

		// trigger!
		public start( l:number=2050, offsetA:number=0.005 ):boolean
		{
            var t:number = this.context.currentTime;

            /*
			this.envelope.gain.setValueAtTime( 1, t );
			this.envelope.gain.linearRampToValueAtTime( 1, 	t + offsetB );
			this.envelope.gain.linearRampToValueAtTime( 0.0,  t + offsetC );
            */

			this.bass.frequency.setValueAtTime( l, t );
			this.bass.frequency.exponentialRampToValueAtTime( 80, t + offsetA );

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