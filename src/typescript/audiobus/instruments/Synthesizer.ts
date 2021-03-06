/// <reference path="../Dependencies.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class Synthesizer extends Instrument
    {
		// shared variables
		//public bpm:number = 120;
		//public tempo:number; mn
		public noise:AudioBufferSourceNode;
		public noiseBuffer:AudioBuffer;
		public noiseData:Float32Array;
		public naeg:GainNode;				// Noise volume

		public f1:BiquadFilterNode;
		public f2:BiquadFilterNode;

		public aeg1:GainNode;
		public aeg2:GainNode;
		public aeg3:GainNode;
		public aeg4:GainNode;
		public aeg5:GainNode;
		public aeg6:GainNode;

		private osc1:OscillatorNode;
		private osc2:OscillatorNode;
		private osc3:OscillatorNode;
		private osc4:OscillatorNode;
		private osc5:OscillatorNode;
		private osc6:OscillatorNode;
		private osc7:OscillatorNode;
		private osc8:OscillatorNode;
		private osc9:OscillatorNode;
		private oscA:OscillatorNode;
		private oscB:OscillatorNode;
		private oscC:OscillatorNode;

		// starts here...
		constructor(audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
		}

		private setup():void
		{
			//	GENERATE NOISE
			this.noiseBuffer = this.context.createBuffer(1, 22050, 22050);
			this.noiseData = this.noiseBuffer.getChannelData(0);

			for (var i = 0, l = this.noiseData.length; i < l ; ++i)
			{
				this.noiseData[i] = (Math.random() - 0.5) * 2;
			}

			this.noise = this.context.createBufferSource();
			this.noise.loop = true;
			this.noise.buffer = this.noiseBuffer;

			this.naeg = this.context.createGain();

			this.noise.connect( this.naeg );
			this.naeg.connect( this.gain );

			//	GENERATE OSCILLATOR 1 (sine)
			this.osc1 = this.context.createOscillator();
			this.osc1.type = OscillatorTypes.SINE; // sine wave

			this.aeg1 = this.context.createGain();

			this.osc1.connect( this.aeg1 );
			this.aeg1.connect( this.gain );

			//	GENERATE OSCILLATOR 2 (sine)
			this.osc2 = this.context.createOscillator();
			this.osc2.type = OscillatorTypes.SINE; // sine wave
			this.aeg2 = this.context.createGain();

			this.osc2.connect( this.aeg2 );
			this.aeg2.connect( this.gain );

			//	GENERATE OSCILLATOR 3 (sine)
			this.osc3 = this.context.createOscillator();
			this.osc3.type = OscillatorTypes.SINE; // sine wave

			this.aeg3 = this.context.createGain();

			this.osc3.connect( this.aeg3 );
			this.aeg3.connect( this.gain );

			//	GENERATE OSCILLATOR 4 (sine)
			this.osc4 = this.context.createOscillator();
			this.osc4.type = OscillatorTypes.SINE; // sine wave

			this.aeg4 = this.context.createGain();

			this.osc4.connect( this.aeg4 );
			this.aeg4.connect( this.gain );

			//	GENERATE OSCILLATOR 5,6,7,8,9,A (square)
			this.osc5 = this.context.createOscillator();
			this.osc5.type = OscillatorTypes.SQUARE; // square wave
			this.osc5.frequency.value = 600;

			this.osc6 = this.context.createOscillator();
			this.osc6.type = OscillatorTypes.SQUARE; // square wave
			this.osc6.frequency.value = 900;

			this.osc7 = this.context.createOscillator();
			this.osc7.type = OscillatorTypes.SQUARE; // square wave
			this.osc7.frequency.value = 1300;

			this.osc8 = this.context.createOscillator();
			this.osc8.type = OscillatorTypes.SQUARE; // square wave
			this.osc8.frequency.value = 2000;

			this.osc9 = this.context.createOscillator();
			this.osc9.type = OscillatorTypes.SQUARE; // square wave
			this.osc9.frequency.value = 2300;

			this.oscA = this.context.createOscillator();
			this.oscA.type = OscillatorTypes.SQUARE; // square wave
			this.oscA.frequency.value = 2800;

			this.f1 = this.context.createBiquadFilter();
			this.f1.type = OscillatorTypes.SQUARE; // HP filter
			this.f1.frequency.value = 10000;

			this.f2 = this.context.createBiquadFilter();
			this.f2.type = OscillatorTypes.SQUARE; // HP filter
			this.f2.frequency.value = 10000;

			this.aeg5 = this.context.createGain();

			this.osc5.connect(this.f1);
			this.osc6.connect(this.f1);
			this.osc7.connect(this.f1);
			this.osc8.connect(this.f1);
			this.osc9.connect(this.f1);
			this.oscA.connect(this.f1);
			this.f1.connect(this.f2);
			this.f2.connect( this.aeg5 );
			this.aeg5.connect( this.gain);

			//	GENERATE COWBELL
			this.oscB = this.context.createOscillator();
			this.oscB.type = OscillatorTypes.SQUARE; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = this.context.createOscillator();
			this.oscC.type = OscillatorTypes.SQUARE; // square wave
			this.oscC.frequency.value = 1400;

			this.aeg6 = this.context.createGain();

			this.oscB.connect( this.aeg6 );
			this.oscC.connect( this.aeg6 );
			this.aeg6.connect(this.gain);

			// 	ROUTE SIGNALS - MIX AND OUTPUT
			this.gain.connect( this.context.destination );

			// start all the oscillators if its firefox...
			/*
			this.osc1.start(0);
			this.osc2.start(0);
			this.osc3.start(0);
			this.osc4.start(0);
			this.osc5.start(0);
			this.osc6.start(0);
			this.osc7.start(0);
			this.osc8.start(0);
			this.osc9.start(0);
			this.oscA.start(0);
			this.oscB.start(0);
			this.oscC.start(0);
			this.noise.start(0);
			*/
		}

		/*
		set volume( vol:number=1 ):void
		{
			this.gain.gain = vol;
		}

		get volume( ):number
		{
			return this.gain.gain;
		}
		*/
		// TRIGGERS


		public bassdrum( l:number=2050, offsetA:number=0.005, offsetB:number=0.01, offsetC:number=0.7):void
		{
			var t = this.context.currentTime;

			this.aeg1.gain.cancelScheduledValues( t );
			this.aeg1.gain.setValueAtTime( 1, t );
			this.aeg1.gain.linearRampToValueAtTime( 1, 	t + offsetB );
			this.aeg1.gain.linearRampToValueAtTime( 0.0,  t + offsetC );

			this.osc1.frequency.setValueAtTime( l, t );
			this.osc1.frequency.exponentialRampToValueAtTime( 80, t + offsetA );

			console.log( this.osc1 );

			//this.osc1.start(0);
		}

		public snare():void
		{
			var t = this.context.currentTime;

			//this.naeg.gain.cancelScheduledValues( t );
			this.naeg.gain.setValueAtTime(1, t);
			this.naeg.gain.linearRampToValueAtTime(1,  t + 0.025);
			this.naeg.gain.exponentialRampToValueAtTime(0.2, 	t + 0.050);
			this.naeg.gain.linearRampToValueAtTime(0.0,  t + 0.300);

			//this.noise.start(0);
		}

		public hihat():void
		{
			var t = this.context.currentTime;

			//naeg.gain.setValueAtTime(0.2, t);
			//naeg.gain.linearRampToValueAtTime(0,  t + 0.025);

			this.f1.frequency.setValueAtTime(20, t);
			this.f1.frequency.linearRampToValueAtTime(16000, 	t + 0.050);
			this.f2.frequency.setValueAtTime(20, t);
			this.f2.frequency.linearRampToValueAtTime(16000, 	t + 0.050);

			//this.aeg5.gain.cancelScheduledValues( t );
			this.aeg5.gain.setValueAtTime(0.4, t);
			this.aeg5.gain.linearRampToValueAtTime(0.4,  t + 0.025);
			this.aeg5.gain.exponentialRampToValueAtTime(0.1, 	t + 0.050);
			this.aeg5.gain.linearRampToValueAtTime(0.0,  t + 0.300);

			//noise.start(0);

			//this.osc5.start(0);
			//this.osc6.start(0);
			//this.osc7.start(0);
			//this.osc8.start(0);
			//this.osc9.start(0);
			//this.oscA.start(0);
		}


		public conga():void
		{
			var t = this.context.currentTime;
			this.osc2.frequency.setValueAtTime(1200, t);
			this.osc2.frequency.linearRampToValueAtTime(800, t + 0.005);

			//this.aeg2.gain.cancelScheduledValues( t );
			this.aeg2.gain.setValueAtTime(0.5, t);
			this.aeg2.gain.exponentialRampToValueAtTime(0.5, 	t + 0.010);
			this.aeg2.gain.linearRampToValueAtTime(0.0,  t + 0.160);

			//this.osc2.start(0);
		}


		public cowbell( offsetA:number=0.025, offsetB:number=0.05, offsetC:number=0.4 ):void
		{
			var t:number = this.context.currentTime;

			//this.aeg6.gain.cancelScheduledValues( t );
			this.aeg6.gain.setValueAtTime(1, t);
			this.aeg6.gain.linearRampToValueAtTime( 1,  t + offsetA );
			this.aeg6.gain.exponentialRampToValueAtTime( 0.2, t + offsetB );
			this.aeg6.gain.linearRampToValueAtTime( 0.0,  t + offsetC );

			//this.oscB.start(0);
			//this.oscC.start(0);
		}





		public trigger( id:number=0 ):void
		{
			switch (id)
			{
				case 1:
					this.snare();
					break;
				case 2:
					this.hihat();
					break;
				case 3:
					this.conga();
					break;
				case 4:
					this.cowbell();
					break;

				case 0:
				default:
					this.bassdrum();
			}
		}
	}
}