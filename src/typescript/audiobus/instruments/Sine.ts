/// <reference path="../Dependencies.ts"/>
///<reference path="Instrument.ts" />
///<reference path="../ISoundControl.ts" />
module audiobus.instruments
{
    export class Sine extends Instrument implements ISoundControl
    {
		private osc:OscillatorNode;

		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			this.create();
		}

		private create():void
		{
			// Synthesize!
			this.osc = this.context.createOscillator();
			this.osc.type = OscillatorTypes.SINE; // sine wave
			this.osc.connect( this.gain );
		}

		public start( frequency:number ):void
		{
			//console.log("Sine commencing at f:"+frequency );
			var t:number = this.context.currentTime;

			this.osc.frequency.value = frequency;
			//this.osc.frequency.setValueAtTime(1200, t);
			//this.osc.frequency.linearRampToValueAtTime(800, t + 0.005);

			//this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.cancelScheduledValues( t );

			if ( this.isPlaying )
			{
				// this note is already playing so don't tweak it.
				this.gain.gain.value = .5;
			}else{
				// freshly playing so ADSR it
				//this.gain.gain.value = .5;
				//this.gain.gain.setValueAtTime(0.0001, t);
    			// An exception will be thrown if this value is less than or equal to 0,
				// or if the value at the time of the previous event is less than or equal to 0.
				//this.gain.gain.exponentialRampToValueAtTime( 0.5, t + 0.001 );
				//this.gain.gain.value = .5;

				//this.gain.gain.setValueAtTime(0.0000000000001, t);
				this.gain.gain.exponentialRampToValueAtTime( 0.5, t + this.durationFadeIn );

				console.log( 'trying to start '+this.isPlaying );
			}

			//console.log( 'hasInitialised '+this.hasInitialised+ ' state:' + this.osc.playbackState );
			if ( !this.hasInitialised ){ this.osc.start(t); }
			super.start();
		}

		public stop():void
		{
			if ( !this.hasInitialised ){ return;}
			console.log( 'stop playing? '+this.isPlaying  );
			//this.osc.stop( 0 );
			super.stop();
		}

	}

}