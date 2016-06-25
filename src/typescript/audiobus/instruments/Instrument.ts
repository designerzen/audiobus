// interface IPlugs
module audiobus.instruments
{
    export class Instrument
    {
		public context:AudioContext;
		public gain:GainNode;

		public isPlaying:boolean = false;         // currently started
		public hasInitialised:boolean = false;    // are oscillators swinging?
		public needsUpdate:boolean = false;       // does it need an external update?

        // DADSHR
        public delay:number = 0;        // pregnant pause - inspired by the Prophet`08
        public attack:number = 0.2;       // how aggressive the intro fade is
        public amplitude:number = 0.5;  // overall output volume
        public decay:number = 1;        // how much to let off after the intro before...
        public sustain:number = 0.4;    // how loud is the afternote
        public hold:number = 1;         // how long to hold the note for
        public release:number = 1.2;      // how long does the fade out last

		public SILENCE:number = 0.00000001;//Number.MIN_VALUE*100000000000;

		public set volume( vol:number )
		{
            var t:number = this.context.currentTime;
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.value = vol;
			this.amplitude = vol;
		}

		public get volume( ):number
		{
			return this.gain.gain.value;
		}

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode=null, source:AudioNode=null )
		{
			this.context = audioContext;
			this.gain = audioContext.createGain();
            this.gain.gain.value = this.amplitude;

            if (outputTo || source) this.connect( outputTo, source );

            // TODO: add itself to the conductor so that we can call
            // all instruments together with one call
		}

        public connect( outputTo:AudioNode, source:AudioNode):void
        {
            if (outputTo){ this.gain.connect( outputTo ); };
            //if (source){};
        }

        // Handles : Delay -> Attack -> Decay -> Sustain -> Release
		public start( ...args: any[] ):boolean
		{
            var initialising:boolean = !this.hasInitialised;
			if (initialising)
            {
                this.hasInitialised = true;
            }

            // it might already be fading in, but as we only fade from
            // one volume to another, it would just fade 1 -> 1
            this.fadeIn( this.attack, this.decay, this.sustain, this.delay );
            this.isPlaying = true;
            console.log( "start via attack "+this.attack, this );

			//console.log( 'start ' +this.isPlaying  );
            return initialising;
		}

        public note( frequency:number ):boolean
        {
            return this.isPlaying;
        }

        // Handles : Hold -> Release
		public stop( fade:boolean=true ):boolean
		{
            // already playing or not initialised - nothing to stop
			if ( !this.hasInitialised || !this.isPlaying ) return false;

            // An exception will be thrown if this value is less than or equal to 0,
			// or if the value at the time of the previous event is less than or equal to 0.
			if (fade)
            {
                this.fadeOut( this.release );
            } else{
                this.gain.gain.cancelScheduledValues( this.context.currentTime );
                //this.gain.gain.value = 0;
                this.gain.gain.setValueAtTime( 0, this.context.currentTime );
            }

			this.isPlaying = false;
            console.log( "stopping via "+(fade?"fade":"cut"), this);

            return true;
		}

        // Handles : Delay -> Attack -> Decay -> Sustain -> Hold
		public fadeIn( duration:number=0.1, decay:number=0.1, sustain:number=0.1, delay:number=0 ):void
		{
			var t:number = this.context.currentTime;
            var position:number;
			//console.log( "fading out in "+time );
            this.gain.gain.cancelScheduledValues( t );

			if ( this.isPlaying )
			{
				// this note is already playing so don't tweak it.
				// this.gain.gain.value = .5;
                position = delay + t;// + 0.05;
                this.gain.gain.linearRampToValueAtTime( this.amplitude, position );
                this.gain.gain.setValueAtTime( this.amplitude, position );
			}else{
				// freshly playing so ADSR it
				//this.gain.gain.value = .5;
				//this.gain.gain.setValueAtTime(0.0001, t);

    			// An exception will be thrown if this value is less than or equal to 0,
				// or if the value at the time of the previous event is less than or equal to 0.
				// this.gain.gain.setValueAtTime(0.0000000000001, t);
                position = delay + t + duration;
                // Attack
				//this.gain.gain.exponentialRampToValueAtTime( this.amplitude, position );
                this.gain.gain.linearRampToValueAtTime( this.amplitude, position );
                // Decay to Sustain
                this.gain.gain.exponentialRampToValueAtTime( sustain, position+decay );
                // Sustain & Hold
                this.gain.gain.setValueAtTime(this.sustain, position+decay);
			}
		}

        // Handles : Hold -> Release
		public fadeOut( duration:number=0.1, delay:number=0 ):void
		{
			var t:number = this.context.currentTime;
			this.gain.gain.cancelScheduledValues( t );

            // Release
			//this.gain.gain.exponentialRampToValueAtTime( this.SILENCE, delay + t + duration );
			this.gain.gain.linearRampToValueAtTime( this.SILENCE, delay + t + duration );

            // Silence
            //this.gain.gain.setValueAtTime( 0, delay + t + duration + 0.00001 );
            this.gain.gain.setValueAtTime( 0, delay + t + duration );
		}

		public onFaded(  ):void
		{
			//alert("fade complete "+this.gain.gain);
		}

	}
}