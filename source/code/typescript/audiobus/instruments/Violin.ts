/// <reference path="../Dependencies.ts" />
///<reference path="Instrument.ts" />

module audiobus.instruments
{
    export class Violin extends Instrument
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

			//	GENERATE OSCILLATOR 1 (sine)
			this.osc1 = this.context.createOscillator();
			this.osc1.type = OscillatorTypes.SINE; // sine wave


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


	}
}