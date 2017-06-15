export default class Timer
{
  public now:Function = () => window.performance && window.performance.now ? window.performance.now() : Date.now();

  protected period:number = 6000;
	protected lastBarTimeStamp:number = 0;

	protected playing:boolean = false;

	protected startTime:number = 0;
	protected percentage:number = 0;

	protected onMillisecond:{ (scope:Timer, startTime:number, time:number):void; } = (scope:Timer, startTime:number, time:number) => {};
	protected onTick:{ (scope:Timer, startTime:number, time:number):void; } = (scope:Timer, startTime:number, time:number) => {};
	protected onProgress:{ (scope:Timer, startTime:number, time:number):void } = (scope:Timer, startTime:number, time:number) => {};

	//protected onprogress:Function;

	get isPlaying():boolean
	{
		return this.playing;
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
    this.startTime = this.now();

    // trigger immediately!
    this.onTimer( this.startTime );
	}

	public stop():void
	{
		this.playing = false;
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
			const now:number = this.now();
			// check to see if time has elapsed (at least as granular as we can see)
			if (now > time)
			{
				this.onMillisecond && this.onMillisecond( this, this.startTime, now );
			}
			requestAnimationFrame( () => this.onTimer(now) );
		}
	}
}
