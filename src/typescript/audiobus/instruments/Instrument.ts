///<reference path="../definitions/waa.d.ts" />
module audiobus.instruments
{
    export class Instrument
    {
		public context:AudioContext;
		public gain:GainNode;
		
		/*
		public set volume( vol:number=1 )
		{
			this.gain.gain = vol;
		}
		
		public get volume( ):number
		{
			return this.gain.gain;
		}
		*/
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			this.context = audioContext;
			this.gain = audioContext.createGain();
			this.gain.connect( outputTo );
		}
	}
	
}