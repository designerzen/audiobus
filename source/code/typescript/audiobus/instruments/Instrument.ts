// interface IPlugs

import Envelope from '../envelopes/Envelope';
import AudioComponent from '../AudioComponent';
import ICommand from '../ICommand';

export default class Instrument extends AudioComponent
{
		public isPlaying:boolean = false;         // currently started
		public hasInitialised:boolean = false;    // are oscillators swinging?
		public needsUpdate:boolean = false;       // does it need an external update?

		public SILENCE:number = 0.00000001;				//Number.MIN_VALUE*100000000000;
		public envelope:Envelope;									// all instruments have an envelope to control sound shape

	
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
			this.envelope.input = port;//.connect( port );
		}
			
		// create
		constructor( audioContext:AudioContext=undefined )
		{
      super(audioContext);
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
      const initialising:boolean = !this.hasInitialised;
			if (initialising)
      {
        this.hasInitialised = true;
      }

			const time:number = this.context.currentTime + 0.005;
      // it might already be fading in, but as we only fade from
      // one volume to another, it would just fade 1 -> 1
      const position:number = this.envelope.start(time, true);

      this.isPlaying = true;
      //console.log( "start : "+position, this);

			//console.log( 'start ' +this.isPlaying  );
      return initialising;
		}

    public note( frequency:number ):boolean
    {
      return this.isPlaying;
    }

    ////////////////////////////////////////////////////////////////////////////
    // Handles : Hold -> Release
    ////////////////////////////////////////////////////////////////////////////
		public stop():boolean
		{
      // already playing or not initialised - nothing to stop
			if ( !this.hasInitialised || !this.isPlaying )
      {
        return false;
      }

      this.envelope.stop();

      // An exception will be thrown if this value is less than or equal to 0,
			// or if the value at the time of the previous event is less than or equal to 0.
			this.isPlaying = false;
      console.log( "stopping", this);

      return true;
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

		public chordOn( chord:number=1, velocity:number=1, delay:number=0)
		{

		}

		public chordOff( chord:number=1, delay:number=0)
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

        */

}
