///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
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
			this.oscB.type = 1; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = audioContext.createOscillator();
			this.oscC.type = 1; // square wave
			this.oscC.frequency.value = 1400;

			
			this.oscB.connect( this.gain );
			this.oscC.connect( this.gain );
		}
		
		public start(offsetA:number=0.025, offsetB:number=0.05, offsetC:number=0.4):void
		{
			var t:number = this.context.currentTime;
			
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(1, t);
			this.gain.gain.linearRampToValueAtTime( 1,  t + offsetA );
			this.gain.gain.exponentialRampToValueAtTime( 0.2, t + offsetB );
			this.gain.gain.linearRampToValueAtTime( 0.0,  t + offsetC );
			
			this.oscB.start(0);
			this.oscC.start(0);
		}
	}
	
}