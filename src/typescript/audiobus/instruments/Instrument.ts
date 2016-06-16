/// <reference path="../Dependencies.ts"/>

// interface IPlugs
module audiobus.instruments
{
    export class Instrument
    {
		public context:AudioContext;
		public gain:GainNode;
        
		public isPlaying:boolean = false;
		public hasInitialised:boolean = false;

		public durationFadeIn:number = 0.05;
		public durationFadeOut:number = 3;

		public SILENCE:number = 0.00000001;//Number.MIN_VALUE*100000000000;

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
			this.gain = this.context.createGain();
			this.gain.connect( outputTo );
		}

		public start( ...args: any[] ):void
		{
			var t:number = this.context.currentTime;

			this.isPlaying = true;
			this.hasInitialised = true;
			console.log( 'start ' +this.isPlaying  );
		}

		public stop():void
		{
			if ( !this.hasInitialised || !this.isPlaying ) { return; };

			//this.gain.gain.value = 0;
			//
    			// An exception will be thrown if this value is less than or equal to 0,
				// or if the value at the time of the previous event is less than or equal to 0.
			//
			this.fadeOut(this.durationFadeOut);
			console.log( 'stop vol:', this.gain );
			//if (this.gain.gain.value > 0 ) console.error('could not stop'+this);
			this.isPlaying = false;
		}

		public fadeIn( time:number=0.1 ):void
		{
			var t:number = this.context.currentTime;
			console.log( "fading out in "+time );
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.exponentialRampToValueAtTime( 0.5, t + time );
			this.gain.gain.setValueAtTime(0.5, t + time);
		}

		public onFaded(  ):void
		{
			alert("fade complete "+this.gain.gain);
		}
		public fadeOut( time:number=0.1 ):void
		{
			var t:number = this.context.currentTime;
			console.log( "fading out in "+time );
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.exponentialRampToValueAtTime( this.SILENCE, t + time );
			this.gain.gain.setValueAtTime(0, t + time);
		}

	}

}