import Timer from './Timer';

export default class Metronome extends Timer
{
	constructor()
	{
		super();
	}

	// a way of converting a quantity of beats per minute into periods of bar length
	private set bpm( beatsPerMinute:number )
	{
		const seconds:number = 60 / beatsPerMinute ;
		const elapsed:number =  this.now() - this.lastBarTimeStamp;	// fetch last bar timestamp and minus from NOW
		this.period = seconds * 1000;
		this.percentage = elapsed / this.period;
	}

	private get bpm():number
	{
		return ( 60 / ( this.period * 0.001 ) );
	}

	////////////////////////////////////////////////////////////////////////
	// Begin & End the Netronome timer
	////////////////////////////////////////////////////////////////////////
	public start( bpm:number=90 ):void
	{
		this.bpm = bpm;
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
			this.percentage = 0;
	    this.lastBarTimeStamp += this.period;

			// callback! make sure that the scope is consistent
			//this.callOnBeat.apply( time );

			// scope:Timer, startTime:number, time:number
			this.onTick( this, this.startTime, time );
		}

		// pass on a progress event!
		// this contains the percentage that the bar has elapsed
		if ( this.onProgress && progress > this.percentage )
		{
			this.percentage = progress;
			// scope:Timer, startTime:number, elapsed:number, now:number
			this.onProgress( this, this.startTime, time );
		}

		// loop
		super.onTimer( time );
	}
}
