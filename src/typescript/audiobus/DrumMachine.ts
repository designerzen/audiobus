/// <reference path="Dependencies.ts" />
module audiobus
{
    export class DrumMachine
    {
		// shared variables
		public bpm:number = 120;
		public tempo:number;

		public bassdrum:audiobus.instruments.BassDrum;
		public snare:audiobus.instruments.Snare;
		public hihat:audiobus.instruments.HiHat;
		public conga:audiobus.instruments.Conga;
		public cowbell:audiobus.instruments.CowBell;

		public dsp:AudioContext;
		public gain:GainNode;			// MAIN volume

		/*
		public set volume( vol:number=1 ):void
		{
			this.gain.gain = vol;
		}

		public get volume( ):number
		{
			return this.gain.gain;
		}
		*/
		// starts here...
		constructor( audioContext:AudioContext = null, outputTo:GainNode = null )
		{
			var available:boolean = this.initDSP( window );
			if (!available)
			{
				// END prematurely ;(
				alert('Web Audio API is not supported in this browser');
			}else{
				this.setup();
			}
		}

		private initDSP( window ):boolean
		{
			try {
				// Fix up for prefixing
				window.AudioContext = window.AudioContext || window.webkitAudioContext || window.msAudioContext || window.mozAudioContext;
				this.dsp = new AudioContext();
				this.dsp.sampleRate = 22050;
				return true;

			} catch(error) {

				return false;
			}
		}

		private setup():void
		{
			// Setup Main OUTPUT LEVEL
			this.gain = this.dsp.createGain();

			// Create Instruments
			this.bassdrum    = new audiobus.instruments.BassDrum( this.dsp, this.gain );
			this.conga       = new audiobus.instruments.Conga( this.dsp, this.gain );
			this.snare       = new audiobus.instruments.Snare( this.dsp, this.gain );
			this.hihat       = new audiobus.instruments.HiHat( this.dsp, this.gain );
			this.cowbell     = new audiobus.instruments.CowBell( this.dsp, this.gain );

			// If you want to connect this DrumMachine machine to
			// another DrumMachine machine or to the Spectrum Analyser
			// this is the place to intercept it!


			// 	Route SIGNALS - MIX AND OUTPUT
			this.gain.connect( this.dsp.destination );

			// Fix FF
			//for legacy browsers
			//this.osc1.start = this.osc1.start || this.osc1.noteOn;
			//this.osc1.stop = this.osc1.stop || this.osc1.noteOff;
		}

		public trigger( id:number=0 ):void
		{
			switch (id)
			{
				default:
				case 0:
					this.bassdrum.start(2050, 0.005, 0.01, 0.7);
					break;
				case 1:
					this.bassdrum.start(4050, 0.007, 0.01, 0.6);

					break;
				case 2:
					this.bassdrum.start(8050, 0.008, 0.03, 0.5);

					break;
				case 3:
					this.bassdrum.start(12050, 0.005, 0.01, 0.4);

					break;

				case 4:
					this.snare.start( 2050, 0.005, 0.01, 0.1);
					break;
				case 5:
					this.snare.start( 2050, 0.006, 0.02, 0.1);
					break;
				case 6:
					this.snare.start( 2050, 0.007, 0.03, 0.1);
					break;

				case 7:
					this.snare.start( 2050, 0.008, 0.04, 0.1);
					break;
				case 8:
					this.conga.start( 1200, 0.160);
					break;
				case 9:
					this.conga.start( 2200, 0.260);

					break;
				case 10:
					this.conga.start( 3200, 0.360);

					break;
				case 11:
					this.conga.start( 4200, 0.460);

					break;
				case 12:
					this.cowbell.start( 0.025, 0.05, 0.4);
					break;
				case 13:
					this.cowbell.start( 0.020, 0.04, 0.3);
					break;
				case 14:
					this.cowbell.start( 0.015, 0.03, 0.2);
					break;
				case 15:
					this.cowbell.start( 0.010, 0.02, 0.3);
					break;
				case 16:
					this.cowbell.start( 0.005, 0.01, 0.2);
					break;
			}
		}
	}
}