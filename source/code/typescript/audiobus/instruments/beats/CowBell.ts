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
    export class CowBell extends Drum
    {
		private oscB:OscillatorNode;
		private oscC:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:AudioNode )
		{
			super( audioContext );

			// Synthesize!
			//GENERATE COWBELL
			this.oscB = audioContext.createOscillator();
			this.oscB.type = OscillatorTypes.SQUARE; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = audioContext.createOscillator();
			this.oscC.type = OscillatorTypes.SQUARE; // square wave
			this.oscC.frequency.value = 1400;

            // we send null to connect as we are handling the
            // source connections manually here
			this.oscB.connect( this.gain );
			this.oscC.connect( this.gain );

            // Shape the output waveform
            this.envelope.attackTime = 0.025;
            this.envelope.decayTime = 0.05;
            this.envelope.releaseTime = 0.4;
            this.envelope.sustainVolume = 0.2;
            this.envelope.decayType = audiobus.envelopes.Envelope.CURVE_TYPE_EXPONENTIAL;

            this.connect( outputTo, null );
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

}