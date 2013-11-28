///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class Conga extends Instrument
    {
		private osc2:OscillatorNode;
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			// Synthesize!
			this.osc2 = audioContext.createOscillator();
			this.osc2.type = 0; // sine wave
			this.osc2.connect( this.gain );
		}
		
		public start():void
		{
			var t:number = this.context.currentTime;
			
			this.osc2.frequency.setValueAtTime(1200, t);
			this.osc2.frequency.linearRampToValueAtTime(800, t + 0.005);
			
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.5, t);
			this.gain.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + 0.160);
			
			this.osc2.start(0);	
		}
	}
	
}