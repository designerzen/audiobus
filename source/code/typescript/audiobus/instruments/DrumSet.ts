import Envelope from '../envelopes/Envelope';
import AudioComponent from '../AudioComponent';
import ICommand from '../ICommand';
import Instrument from './Instrument';

export class DrumSet extends Instrument
{
	public bassdrum:BassDrum;
	public snare:Snare;
	public hihat:HiHat;
	public conga:Conga;
	public cowbell:CowBell;
	public tom:Tom;

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
	constructor( audioContext?:AudioContext )
	{
		super(audioContext);

    this.setup();
    // 	Route SIGNALS - MIX AND OUTPUT

    //this.gain.connect( this.context.destination );
	}

	private setup():void
	{
		// Create Instruments
		this.bassdrum    = new BassDrum( this.context );
		this.conga       = new Conga( this.context );
		this.snare       = new Snare( this.context );
		this.hihat       = new HiHat( this.context );
		this.cowbell     = new CowBell( this.context );
		this.tom         = new Tom( this.context );

		// If you want to connect this DrumMachine machine to
		// another DrumMachine machine or to the Spectrum Analyser
		// this is the place to intercept it!



	}

	public trigger( id:number=0 ):void
	{
		switch (id)
		{

			case 0:
				this.bassdrum.start(200+Math.random()*6000, 20+Math.random()*100, 0.005);
				break;
			case 1:
				this.bassdrum.start(4050,80, 0.0076);
				break;
			case 2:
				this.bassdrum.start(8050, 80,0.008);
				break;
			case 3:
				this.bassdrum.start(12050, 80,0.005);
				break;

			case 4:
				this.snare.start( 2050, 0.005);
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

              default:
                  if ( id < 20 )
                  {
                      this.bassdrum.start(30+Math.random()*600,id+Math.random()*100, 0.005);

                  }else if ( id >= 20 && id < 40 ){

                      this.snare.start( 1050+id*10, 0.005);

                  }else if ( id >= 40 && id < 60 ){

                      this.conga.start( id+1000, 0.160);

                  }else if ( id >= 60 && id < 80 ){

                      this.cowbell.start( 0.025, 0.05, Math.random() );

                  }else if ( id >= 80 && id < 100 ){

                      this.tom.start( 10, id + 10 );

                  }else if ( id >= 100 && id < 120 ){

                  }
		}
	}
}
