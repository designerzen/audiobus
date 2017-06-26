// interface IPlugs

import Envelope from '../envelopes/Envelope';
import AudioComponent from '../AudioComponent';
import ICommand from '../ICommand';
import Conductor from '../Conductor';

export default class Instrument extends AudioComponent
{
		protected active:boolean = false;         		// currently making sound
		protected playing:boolean = false;         		// currently started (not stopped)
		protected hasInitialised:boolean = false;   	// are we ready to go?
		public needsUpdate:boolean = false;       	// does it need an external update?

		public SILENCE:number = 0.00000001;				//Number.MIN_VALUE*100000000000;
		public envelope:Envelope;									// all instruments have an envelope to control sound shape

		public get isPlaying():boolean
		{
			return this.playing;
		}

		// Get the port where the data comes out from...
		public get hasStarted():boolean
		{
			return this.envelope.hasStarted;
		}
		public get hasFinished():boolean
		{
			return this.envelope.hasFinished;
		}

		public get endsAt():number
		{
			return this.envelope.endsAt;
		}

	  public get remaining():number
	  {
			return this.envelope.remaining;
	  }

		// Get the port where the data comes out from...
		// public set output(port:AudioNode)
		// {
		// 	//this.envelope.output.connect( port );
		// 	port.connect( this.outputGainNode ); // outputGainNode
		// }

		// // Set which port this device gets it's data from...
		public set input( port:AudioNode )
		{
			this.inputAudioNode = port;
			console.error("Connecting envelope input to ", port);
			this.envelope.input = port;//.connect( port );
		}

		// create
		constructor( audioContext?:AudioContext )
		{
      super(audioContext);
			this.name = "Instrument";

			// whenever an instrument is created, an instance is cached with the Conductor...
			// this allows us to send update information to the instrument in realtime

			//
		}

		public create():void
		{
			this.envelope = new Envelope( this.context );
			// set the input of the audio component to the output from the envelope
			//this.input = this.envelope.output;
			this.envelope.output.connect( this.output ); // outputGainNode
			//this.output = this.envelope.output; // outputGainNode
			// from now on, connect all your instruments to the envelope input!
			// this.envelope.input = sources;

      // if (outputTo || source)
      // {
      //     this.connect( outputTo, source );
      // }
      // TODO: add itself to the conductor so that we can call
      // all instruments together with one call
		}
		//
    // public connect( outputTo:AudioNode, source:AudioNode=null):void
    // {
    //   if (source)
    //   {
    //     source.connect( this.gainNode );
    //   }
    //   this.envelope.connect( outputTo , this.gainNode );
    // }

    ////////////////////////////////////////////////////////////////////////////
    // Handles : Delay -> Attack -> Decay -> Sustain -> Release
    ////////////////////////////////////////////////////////////////////////////
		public start( ...args: any[] ):boolean
		{
      if (!this.hasInitialised)
      {
        this.hasInitialised = true;
      }

			const time:number = this.context.currentTime;// + 0.005;	// fudge factor
      // it might already be fading in, but as we only fade from
      // one volume to another, it would just fade 1 -> 1
			// or pass in zero for now...
      const position:number = this.envelope.start(time, true);

			const wasPlaying:boolean = this.playing;
      this.playing = this.active = true;
      //console.log( "start : "+position, this);

			//console.log( 'start ' +this.playing  );
      return wasPlaying;
		}

    public note( frequency:number ):boolean
    {
      return this.playing;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Handles : Hold -> Release
    ////////////////////////////////////////////////////////////////////////////
		public stop( time?:number):boolean
		{
      // already playing or not initialised - nothing to stop
			if ( !this.hasInitialised || !this.playing )
      {
				console.log( "EEROR stopping failed", this);
        return false;
      }
			console.log( "stopping", this);

      this.envelope.stop();

      // An exception will be thrown if this value is less than or equal to 0,
			// or if the value at the time of the previous event is less than or equal to 0.
			this.playing = false;


      return true;
		}

		// called from the conductor... forces the timings to be checked...
		public update( time:number )
		{

		}


		public command( action:ICommand )
		{
			// do something with this data...
		}

		public pitchBend( program:number, delay:number=0)
	  {
			// pitch bend
		}

		public noteOn( note:number, velocity:number=1, delay:number=0)
	  {

		}

		public noteOff( note:number, delay:number=0)
	   {

		}

        /*
        // Handles : Delay -> Attack -> Decay -> Sustain -> Hold
		public fadeIn( duration:number=0.1, decay:number=0.1, sustain:number=0.1, delay:number=0 ):void
		{
			var t:number = this.context.currentTime;
            var position:number;
			//console.log( "fading out in "+time );
            this.gain.gain.cancelScheduledValues( t );

			if ( this.playing )
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

        */
	public toString():string
	{
		let output = "Instrument:" + name+" [input:"+this.input+" output:"+this.output+"]";
		output += " isPlaying:"+this.isPlaying+", hasStarted:"+this.hasStarted+", hasFinished:"+this.hasFinished;
		output += " remaining:"+this.remaining+", endsAt:"+this.endsAt+", now:"+this.context.currentTime;
		return output;
	}

}
