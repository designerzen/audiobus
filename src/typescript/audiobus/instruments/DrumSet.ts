/// <reference path="../Dependencies.ts" />
/// <reference path="Instrument.ts" />
module audiobus.instruments
{
    export class DrumSet extends Instrument
    {
		public bassdrum:audiobus.instruments.beats.BassDrum;
		public snare:audiobus.instruments.beats.Snare;
		public hihat:audiobus.instruments.beats.HiHat;
		public conga:audiobus.instruments.beats.Conga;
		public cowbell:audiobus.instruments.beats.CowBell;

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
			super(audioContext,outputTo);
            this.setup();
		}

		private setup():void
		{
			// Create Instruments
			this.bassdrum    = new audiobus.instruments.beats.BassDrum( this.context, this.gain );
			this.conga       = new audiobus.instruments.beats.Conga( this.context, this.gain );
			this.snare       = new audiobus.instruments.beats.Snare( this.context, this.gain );
			this.hihat       = new audiobus.instruments.beats.HiHat( this.context, this.gain );
			this.cowbell     = new audiobus.instruments.beats.CowBell( this.context, this.gain );

			// If you want to connect this DrumMachine machine to
			// another DrumMachine machine or to the Spectrum Analyser
			// this is the place to intercept it!


			// 	Route SIGNALS - MIX AND OUTPUT
			this.gain.connect( this.context.destination );
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