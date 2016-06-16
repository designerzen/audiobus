/// <reference path="Dependencies.ts" />
module audiobus
{
	export class Netronome
    {
		// Start *all* metronomes from the same point in time
		static EPOCH:number = new Date( 2012, 12, 21, 6, 6, 6 ).getTime();

		private period:number = 6000;
		private lastBarTimeStamp:number;

		private playing:boolean = false;
		public percentage:number = 0;
		//private callOnBeat:Function;
		private callOnBeat:(scope:any,time : number)=>any;
		private callOnProgress:( scope:any,percent : number)=>any;

		private callbackScope;

		// INTERALS =======================================================

		// a way of converting a quantity of beats per minute into periods of bar length
		private setBpm( beatsPerMinute:number ) :number
		{
			if ( beatsPerMinute < 1 ) { return this.getBpm(); }

			var seconds:number = 60 / beatsPerMinute ;


			this.period = seconds * 1000;

			this.lastBarTimeStamp = this.determineStartTime();

			var elapsed:number =  Date.now() - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			this.percentage = elapsed / this.period;


			return beatsPerMinute;
		}

		private getBpm():number
		{
			return ( 60 / ( this.period * 0.001 ) ) >> 0;
		}


		constructor( onBeatCallback:(scope:any, time : number)=>any, onProgressCallback:(scope:any, percent : number)=>any, scope:any )
		{
			// Assign the method implementation here.
			this.callOnBeat = onBeatCallback;
			this.callOnProgress = onProgressCallback;
			/*
			this.callOnBeat = () => {
				onBeatCallback.apply(this, arguments);
			}

			this.callOnProgress = () => {
				onProgressCallback.apply(this, arguments);
			}
			*/
			this.callbackScope = scope;
		}

		////////////////////////////////////////////////////////////////////////
		// Begin & End the Netronome timer
		////////////////////////////////////////////////////////////////////////
		public start( bpm:number=90):void
		{
			this.playing = true;
			this.setBpm( bpm );
			// begin!
			requestAnimationFrame( () =>  this.onTimer() );
		}

		public stop():void
		{
			this.playing = false;
		}

		////////////////////////////////////////////////////////////////////////
		// Work out the timestamp that the last metronome ticked at -
		// This should synchronise across BPMS and periods. For that to occur
		////////////////////////////////////////////////////////////////////////
		private determineStartTime():number
		{
			// so we have a timestamp that shows the time now
			var now:number = Date.now();						// correct :)
			var timeSinceEpoch:number = now - Netronome.EPOCH;			// correct :)
			var elapsed:number = timeSinceEpoch % this.period;
			var remaining:number = this.period - elapsed;
			var lastTick:number =  ( now - elapsed );//  - period- period only for extra buffer room

			//trace( 'CREATING EPOCH now:'+now+" then:"+EPOCH);
		//	trace( ''+Std.int(timeSinceEpoch / period)+" Bars have occurred at "+get_bpm()+ " BPM");
		//	trace( ''+Std.int(elapsed)+" ms elapsed in this bar "+Std.int(elapsed*100/period)+'% Elapsed');
		//	trace( 'lastTick : ' + lastTick + " at " + get_bpm()+ " BPM");
			//trace( 'Remaining Time in Bar '+Std.int(remaining)+" ms "+Std.int(elapsed*100/period)+'% Elapsed');
			//trace( 'Left Over at '+remaining+" period : "+period+' remaining : ' + remaining + ' timestamp : '+( now - remaining) );

			console.log( "lastTick : " + lastTick );
			return lastTick;
		}


		////////////////////////////////////////////////////////////////////////
		//
		////////////////////////////////////////////////////////////////////////
		private incrementCuePoints( now:number = -1  ):void
		{
			// update the last timestamp to about now or before...
			this.lastBarTimeStamp += this.period;
		}

		////////////////////////////////////////////////////////////////////////
		// Check the time to see if a beat has occurred
		////////////////////////////////////////////////////////////////////////
		private onTimer():void
		{
			// discover how much time has elapsed since our last timestamp...
			var time:number = Date.now();
			var elapsed:number = time - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			var progress:number = elapsed / this.period;
			var barOccurred:boolean = elapsed >= this.period;

			// pass on a progress event!
			// this contains the percentage that the bar has elapsed
			//dispatchEvent( new MetronomeEvent( MetronomeEvent.PROGRESS, progress ) );

			// check to see if the bar had elapsed && beatsCompletedBeforeBar
			if ( barOccurred )
			{
				// update the last timestamp to about now or before...
				this.incrementCuePoints( time );
				this.percentage = 0;


				// callback! make sure that the scope is consistent
				//this.callOnBeat.apply( time );
				this.callOnBeat( this.callbackScope, time );

				// call this method immediately again without delay!
				// this should catch any quickly added cue points at low beats
				this.onTimer();
			}

			if ( progress > this.percentage )
			{
				this.percentage = progress;
				this.callOnProgress( this.callbackScope,  this.percentage );
			}

			//console.log("Progress "+this.percentage );

			if ( this.playing ) {
				requestAnimationFrame( () => this.onTimer() );
			}
		}


	}
}
