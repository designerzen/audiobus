///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class BassDrum extends Instrument
    {
		private osc1:OscillatorNode;
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			// Synthesize!
			this.osc1 = audioContext.createOscillator();
			this.osc1.type = 0; // sine wave
			this.osc1.connect( this.gain );
		}
		
		// trigger!
		public start( l:number=2050, offsetA:number=0.005, offsetB:number=0.01, offsetC:number=0.7):void
		{
			var t:number = this.context.currentTime;
			
			this.gain.gain.cancelScheduledValues( t );
			
			this.gain.gain.setValueAtTime( 1, t );
			this.gain.gain.linearRampToValueAtTime( 1, 	t + offsetB );
			this.gain.gain.linearRampToValueAtTime( 0.0,  t + offsetC );

			this.osc1.frequency.setValueAtTime( l, t );
			this.osc1.frequency.exponentialRampToValueAtTime( 80, t + offsetA );

			this.osc1.start(0);
		}
	}
	
}