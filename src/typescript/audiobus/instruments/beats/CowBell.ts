/// <reference path="../../Dependencies.ts"/>
/// <reference path="../Instrument.ts" />
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
    export class CowBell extends Instrument
    {
		private oscB:OscillatorNode;
		private oscC:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );

			// Synthesize!
			//	GENERATE COWBELL
			this.oscB = audioContext.createOscillator();
			this.oscB.type = OscillatorTypes.SQUARE; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = audioContext.createOscillator();
			this.oscC.type = OscillatorTypes.SQUARE; // square wave
			this.oscC.frequency.value = 1400;


			this.oscB.connect( this.gain );
			this.oscC.connect( this.gain );
		}

		public start(offsetA:number=0.025, offsetB:number=0.05, offsetC:number=0.4):boolean
		{
			var t:number = this.context.currentTime;

			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(1, t);
			this.gain.gain.linearRampToValueAtTime( 1,  t + offsetA );
			this.gain.gain.exponentialRampToValueAtTime( 0.2, t + offsetB );
			this.gain.gain.linearRampToValueAtTime( 0.0,  t + offsetC );

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