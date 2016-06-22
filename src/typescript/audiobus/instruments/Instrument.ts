// interface IPlugs
module audiobus.instruments
{
    export class Instrument
    {
		public context:AudioContext;
		public gain:GainNode;

		public isPlaying:boolean = false;
		public hasInitialised:boolean = false;

        // ASDR
        // These relate to the attack and release
        public attack:number = 1;
        public sustain:number = 1;
        public decay:number = 1;
        public release:number = 1;

		public amplitude:number = 0.5;

		public SILENCE:number = 0.00000001;//Number.MIN_VALUE*100000000000;

		public set volume( vol:number )
		{
			this.gain.gain.value = vol;
			this.amplitude = vol;
		}

		public get volume( ):number
		{
			return this.gain.gain.value;
		}

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			this.context = audioContext;
			this.gain = audioContext.createGain();
			this.gain.connect( outputTo );
		}

		public start( ...args: any[] ):boolean
		{
            var initialising:boolean = !this.hasInitialised;
			if (initialising)
            {
                this.hasInitialised = true;
            }

            // it might already be fading in, but as we only fade from
            // one volume to another, it would just fade 1 -> 1
            this.fadeIn(this.attack);
            this.isPlaying = true;

			//console.log( 'start ' +this.isPlaying  );
            return initialising;
		}

        public note( frequency:number ):boolean
        {
            return this.isPlaying;
        }

		public stop( fade:boolean=false ):boolean
		{
            // already playing or not initialised - nothing to stop
			if ( !this.hasInitialised || !this.isPlaying ) return false;

            console.log( "stopping via "+(fade?"fade":"cut"), this);
			// An exception will be thrown if this value is less than or equal to 0,
			// or if the value at the time of the previous event is less than or equal to 0.
			if (fade)
            {
                this.fadeOut( this.release );
            } else{
                this.gain.gain.cancelScheduledValues( this.context.currentTime );
                this.gain.gain.value = 0;
            }

			//console.log( 'stop vol:', this.gain );
			this.isPlaying = false;
            return true;
		}

		public fadeIn( time:number=0.1 ):void
		{
			var t:number = this.context.currentTime;
			//console.log( "fading out in "+time );
            this.gain.gain.cancelScheduledValues( t );

			if ( this.isPlaying )
			{
				// this note is already playing so don't tweak it.
				// this.gain.gain.value = .5;
                this.gain.gain.linearRampToValueAtTime( this.amplitude, t + 0.05 );
                this.gain.gain.setValueAtTime(this.amplitude, t + 0.05);
			}else{
				// freshly playing so ADSR it
				//this.gain.gain.value = .5;
				//this.gain.gain.setValueAtTime(0.0001, t);

    			// An exception will be thrown if this value is less than or equal to 0,
				// or if the value at the time of the previous event is less than or equal to 0.
				// this.gain.gain.setValueAtTime(0.0000000000001, t);
				this.gain.gain.exponentialRampToValueAtTime( this.amplitude, t + time );
                this.gain.gain.setValueAtTime(this.amplitude, t + time);
			}
		}

		public onFaded(  ):void
		{
			//alert("fade complete "+this.gain.gain);
		}

		public fadeOut( time:number=0.1 ):void
		{
			var t:number = this.context.currentTime;
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.exponentialRampToValueAtTime( this.SILENCE, t + time );
			this.gain.gain.setValueAtTime( 0, t + time );
		}

	}

}