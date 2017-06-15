// A way of returning promises at certain times. Requires a an audio context...
import Engine from '../Engine';

export default class Scheduler
{
	protected context:AudioContext;

  public static instance:Scheduler;

  private schedules:Array<Schedule> = [];
  private running:boolean = false;

	// these are shared...
	public static fetch():Scheduler
  {
    if (!Scheduler.instance)
    {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  public get audioContext( ):AudioContext
  {
    return this.context;
  }

  // if no context is specified we get the engine default...
	constructor( audioContext:AudioContext=undefined )
	{
    this.context = Engine.fetch();
	}

  waitUntil( time:number ):Promise<number>
  {
    // returns a promise..
    const promise:Promise<number> = new Promise<number>();

    // stash promise and time
    const schedule:Schedule = new Schedule( time, promise );

    // add this to the queue in the correct position...
    // insert at correct position...
    this.schedules.push( schedule );

    //
    if (!this.running)
    {
      this.start();

    }

    return promise;
  }

  // start timing things...
  start()
  {
    this.running = true;
  }

  // stop timing things...
  stop()
  {
    this.running = false;
  }

  // returns true or false depening on whether there are any remaining events
  resolveSchedulesAfterTime(time):boolean
  {
    // check queue...
    // if we have a promise...
    const schedule:Schedule = this.schedules[0];
    const promise:Promise<boolean> = schedule.promise;
    // resolve the promise!
    promise.resolve(time);

    return this.schedules.length > 0;
  }

  onUpdate( time:number )
  {
    if ( this.running )
		{
			const now:number = this.context.currentTime;
			// check to see if time has elapsed (at least as granular as we can see)
			if (now > time)
			{
				// we have advanced through time!
        // check for events to fire!
        const hasRemainingEvents:boolean = this.resolveSchedulesAfterTime(time);
        if (!hasRemainingEvents)
        {
          this.stop();
        }
			}
			requestAnimationFrame( () => this.onUpdate(now) );
		}


  }

}

export class Schedule
{
  constructor(public time, public promise)
  {

  }
}
