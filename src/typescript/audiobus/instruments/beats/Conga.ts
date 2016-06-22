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
    export class Conga extends Instrument
    {
		private osc:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			// Synthesize!
			this.osc = audioContext.createOscillator();
			this.osc.type = OscillatorTypes.SINE; // sine wave
			this.osc.connect( this.gain );
		}

		public start(  f:number=1200, offsetA:number=0.160 ):boolean
		{
			var t:number = this.context.currentTime;

			this.osc.frequency.setValueAtTime(f, t);
			this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);

			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.5, t);
			this.gain.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + offsetA);

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