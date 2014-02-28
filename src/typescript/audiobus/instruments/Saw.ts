///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class Saw extends Instrument
    {
		private osc:OscillatorNode;
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			// Synthesize!
			this.osc = audioContext.createOscillator();
			this.osc.type = 1; // sine wave
			this.osc.connect( this.gain );
		}
		
		public start( frequency:number ):void
		{
			console.log("Sine commencing at f:"+frequency );
			var t:number = this.context.currentTime;
			
			this.osc.frequency.value = frequency;
			//this.osc.frequency.setValueAtTime(1200, t);
			//this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);
			
			this.gain.gain.value = .5;
			//this.gain.gain.cancelScheduledValues( t );
			//this.gain.gain.setValueAtTime(0.5, t);
			//this.gain.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			//this.gain.gain.linearRampToValueAtTime(0.0,  t + 0.160);
			
			this.osc.start(0);	
		}
		
	}
	
}