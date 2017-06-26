import TimeNow from './TimeNow';

export default class Timer
{
  protected period:number = 6000;
	protected lastBarTimeStamp:number = 0;

	protected playing:boolean = false;
	protected paused:boolean = false;

	protected startTime:number = 0;
	protected percentage:number = 0;

	protected onMillisecond:{ (scope:Timer, startTime:number, time:number):void; } = (scope:Timer, startTime:number, time:number) => {};
	protected onTick:{ (scope:Timer, startTime:number, time:number):void; } = (scope:Timer, startTime:number, time:number) => {};
	protected onProgress:{ (scope:Timer, startTime:number, time:number):void } = (scope:Timer, startTime:number, time:number) => {};

	//protected onprogress:Function;
  get timeStarted():number
  {
    return this.startTime;
  }

	get isPlaying():boolean
	{
		return this.playing;
	}
  get isPaused():boolean
  {
    return this.paused;
  }
	set beat( trigger: { (scope:Timer, startTime:number, time:number):void; })
	{
    this.onTick = trigger;
	}

	set ms( trigger: { (scope:Timer, startTime:number, time:number):void; })
	{
    this.onMillisecond = trigger;
	}

	set progress( trigger: { (scope:Timer, startTime:number, time:number):void; })
	{
    this.onProgress = trigger;
	}

	constructor()
	{

	}

	////////////////////////////////////////////////////////////////////////
	// Begin & End the Netronome timer
	////////////////////////////////////////////////////////////////////////
	public start( rate:number=90 ):void
	{
		this.playing = true;
    this.startTime = TimeNow();

    // trigger immediately!
    this.onTimer( this.startTime );
	}

	public stop():void
	{
		this.playing = false;
	}

  public pause():void
  {
    this.paused = true;
  }

  public resume():void
  {
    this.paused = false;
  }

	////////////////////////////////////////////////////////////////////////
	// Check the time to see if a beat has occurred
	////////////////////////////////////////////////////////////////////////
	public onTimer( time:number ) :void
	{
		//console.log('onTimer');
		// loop
		if ( this.playing )
		{
      // when the timer is paused, we want to ignore all 
			const now:number = this.paused ? time : TimeNow();
			// check to see if time has elapsed (at least as granular as we can see)
			if ( now > time)
			{
				this.onMillisecond && this.onMillisecond( this, this.startTime, now );
			}
			requestAnimationFrame( () => this.onTimer(now) );
		}
	}
}
