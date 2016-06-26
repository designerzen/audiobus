/// <reference path="../Dependencies.ts" />
module audiobus.timing
{
	export class Timer
    {
        public now:Function = () => window.performance && window.performance.now ? window.performance.now() : Date.now();

        public period:number = 6000;
		public lastBarTimeStamp:number = 0;

		public playing:boolean = false;

		public startTime:number = 0;
		public percentage:number = 0;

		public ontick:Function;
		public onprogress:Function;

		constructor(){}

		////////////////////////////////////////////////////////////////////////
		// Begin & End the Netronome timer
		////////////////////////////////////////////////////////////////////////
		public start( rate:number=90 ):void
		{
			this.playing = true;
            this.startTime = this.now();

            // trigger immediately!
            this.ontick( this, this.startTime );
		}

		public stop():void
		{
			this.playing = false;
		}

		////////////////////////////////////////////////////////////////////////
		// Check the time to see if a beat has occurred
		////////////////////////////////////////////////////////////////////////
		public onTimer():void
		{
			// loop
			if ( this.playing ) {
				requestAnimationFrame( () => this.onTimer() );
			}
		}
	}
}
