/// <reference path="../Dependencies.ts" />
/// <reference path="Timer.ts" />
module audiobus.timing
{
	export class Metronome extends Timer
    {
		constructor()
		{
			super();
		}

		// a way of converting a quantity of beats per minute into periods of bar length
		private setBpm( beatsPerMinute:number ) :number
		{
			var seconds:number = 60 / beatsPerMinute ;

			this.period = seconds * 1000;

			var elapsed:number =  this.now() - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			this.percentage = elapsed / this.period;

			return beatsPerMinute;
		}

		private getBpm():number
		{
			return ( 60 / ( this.period * 0.001 ) );
		}

		////////////////////////////////////////////////////////////////////////
		// Begin & End the Netronome timer
		////////////////////////////////////////////////////////////////////////
		public start( bpm:number=90 ):void
		{
			this.setBpm( bpm );
			super.start();
		}

		public stop():void
		{
			this.playing = false;
			super.stop();
		}

		////////////////////////////////////////////////////////////////////////
		// Check the time to see if a beat has occurred
		////////////////////////////////////////////////////////////////////////
		public onTimer():void
		{
			// discover how much time has elapsed since our last timestamp...
			var time:number = this.now();
			var elapsed:number = time - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
			var progress:number = elapsed / this.period;
			var barOccurred:boolean = elapsed >= this.period;

			// check to see if the bar had elapsed && beatsCompletedBeforeBar
			if ( this.ontick && barOccurred )
			{
				// update the last timestamp to about now or before...
				this.percentage = 0;
                this.lastBarTimeStamp += this.period;

				// callback! make sure that the scope is consistent
				//this.callOnBeat.apply( time );
				this.ontick( this, time );
			}

			// pass on a progress event!
			// this contains the percentage that the bar has elapsed
			if ( this.onprogress && progress > this.percentage )
			{
				this.percentage = progress;
				this.onprogress( this,  this.percentage );
			}

			// loop
			super.onTimer();
		}
	}
}
