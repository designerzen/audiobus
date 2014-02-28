///<reference path="../definitions/waa.d.ts" />
///<reference path="../definitions/greensock.d.ts" />

// interface IPlugs
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
		
		public start(...args: any[]):void
		{
			
		}
		
		public stop():void
		{
			this.gain.gain.value = 0;
		}
		
		public fadeIn( time:number=0.1 ):void
		{
			TweenLite.to(this.gain, time, {gain:1, onComplete:this.onFaded });
		}
		
		public onFaded(  ):void
		{
			alert("fade complete "+this.gain.gain);
		}
		public fadeOut( time:number=0.1 ):void
		{
			console.log( "fading out in "+time );
			TweenLite.to( this.gain, time, {gain:0});
		}
		
	}
	
}