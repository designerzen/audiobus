import Timer from './Timer';

export default class Netronome extends Timer
{
		// Start *all* metronomes from the same point in time
		static EPOCH:number = new Date( 2012, 12, 21, 6, 6, 6 ).getTime();

		// INTERALS =======================================================

		// a way of converting a quantity of beats per minute into periods of bar length
		private set bpm( beatsPerMinute:number )
		{
			if ( beatsPerMinute < 1 )
			{
				beatsPerMinute = 1;
			}

			const seconds:number = 60 / beatsPerMinute ;

			this.period = seconds * 1000;

			this.lastBarTimeStamp = this.determineStartTime();

			const elapsed:number =  this.now() - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			this.percentage = elapsed / this.period;
		}

		private get bpm():number
		{
			return ( 60 / ( this.period * 0.001 ) ) >> 0;
		}

		constructor()
		{
			super();
		}

		////////////////////////////////////////////////////////////////////////
		// Begin & End the Netronome timer
		////////////////////////////////////////////////////////////////////////
		public start( bpm:number=90 ):void
		{
			this.bpm = bpm;
			// begin!
			super.start();
		}

		public stop():void
		{
			this.playing = false;
			super.stop();
		}

		////////////////////////////////////////////////////////////////////////
		// Work out the timestamp that the last metronome ticked at -
		// This should synchronise across BPMS and periods. For that to occur
		////////////////////////////////////////////////////////////////////////
		private determineStartTime():number
		{
			// so we have a timestamp that shows the time now
			const now:number = this.now() >> 0;								// correct :)
			const timeSinceEpoch:number = now - Netronome.EPOCH;			// correct :)
			const elapsed:number = timeSinceEpoch % this.period;
			const remaining:number = this.period - elapsed;
			const lastTick:number =  ( now - elapsed );//  - period- period only for extra buffer room

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
		public onTimer( time:number ):void
		{
			// discover how much time has elapsed since our last timestamp...
			const elapsed:number = time - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			const progress:number = elapsed / this.period;
			const barOccurred:boolean = elapsed >= this.period;

			// check to see if the bar had elapsed && beatsCompletedBeforeBar
			if ( this.onTick && barOccurred )
			{
				// update the last timestamp to about now or before...
				this.incrementCuePoints( time );
				this.percentage = 0;

				// callback! make sure that the scope is consistent
				//this.callOnBeat.apply( time );
				this.onTick( this, this.startTime, time );

				// call this method immediately again without delay!
				// this should catch any quickly added cue points at low beats
				this.onTimer( time );
			}

			// pass on a progress event!
			// this contains the percentage that the bar has elapsed
			if ( this.onProgress && progress > this.percentage )
			{
				this.percentage = progress;
				this.onProgress( this, this.startTime, time );
				//console.log("Progress "+this.percentage );
			}

			// loop
			super.onTimer( time );
		}
}
