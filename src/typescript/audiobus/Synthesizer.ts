///<reference path="../../lib/waa.d.ts" />
module audiobus
{
    export class Synthesizer
    {
		// shared variables
		//public bpm:number = 120;
		//public tempo:number;
		
		public dsp:AudioContext;
		
		public masterGain:GainNode;			// MAIN volume 
		
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
		constructor( )
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
			
			// webkitAudioContext || msAudioContext || mozAudioContext
			// if (webkitAudioContext || AudioContext ) this.dsp = new (webkitAudioContext || AudioContext)();
		}	
		
		private setup():void
		{
			// SETUP MAIN OUTPUT LEVEL
			this.masterGain = this.dsp.createGain();
			//this.masterGain.gain = 1;

			//	GENERATE NOISE 
			this.noiseBuffer = this.dsp.createBuffer(1, 22050, 22050);
			this.noiseData = this.noiseBuffer.getChannelData(0);
			
			for (var i = 0, l = this.noiseData.length; i < l ; ++i)
			{
				this.noiseData[i] = (Math.random() - 0.5) * 2;
			}
			
			this.noise = this.dsp.createBufferSource();
			this.noise.loop = true;
			this.noise.buffer = this.noiseBuffer

			this.naeg = this.dsp.createGain();

			this.noise.connect( this.naeg );
			this.naeg.connect( this.masterGain );

			//	GENERATE OSCILLATOR 1 (sine)
			this.osc1 = this.dsp.createOscillator();
			this.osc1.type = 0; // sine wave
				
			this.aeg1 = this.dsp.createGain();

			this.osc1.connect( this.aeg1 );
			this.aeg1.connect( this.masterGain );

			//	GENERATE OSCILLATOR 2 (sine)
			this.osc2 = this.dsp.createOscillator();
			this.osc2.type = 0; // sine wave
			this.aeg2 = this.dsp.createGain();

			this.osc2.connect( this.aeg2 );
			this.aeg2.connect( this.masterGain );

			//	GENERATE OSCILLATOR 3 (sine)
			this.osc3 = this.dsp.createOscillator();
			this.osc3.type = 0; // sine wave
				
			this.aeg3 = this.dsp.createGain();

			this.osc3.connect( this.aeg3 );
			this.aeg3.connect( this.masterGain );

			//	GENERATE OSCILLATOR 4 (sine)
			this.osc4 = this.dsp.createOscillator();
			this.osc4.type = 0; // sine wave
				
			this.aeg4 = this.dsp.createGain();

			this.osc4.connect( this.aeg4 );
			this.aeg4.connect( this.masterGain );

			//	GENERATE OSCILLATOR 5,6,7,8,9,A (square)		
			this.osc5 = this.dsp.createOscillator();
			this.osc5.type = 1; // square wave
			this.osc5.frequency.value = 600;

			this.osc6 = this.dsp.createOscillator();
			this.osc6.type = 1; // square wave
			this.osc6.frequency.value = 900;

			this.osc7 = this.dsp.createOscillator();
			this.osc7.type = 1; // square wave
			this.osc7.frequency.value = 1300;

			this.osc8 = this.dsp.createOscillator();
			this.osc8.type = 1; // square wave
			this.osc8.frequency.value = 2000;

			this.osc9 = this.dsp.createOscillator();
			this.osc9.type = 1; // square wave
			this.osc9.frequency.value = 2300;

			this.oscA = this.dsp.createOscillator();
			this.oscA.type = 1; // square wave
			this.oscA.frequency.value = 2800;

			this.f1 = this.dsp.createBiquadFilter();
			this.f1.type = 1 // HP filter
			this.f1.frequency.value = 10000;
				
			this.f2 = this.dsp.createBiquadFilter();
			this.f2.type = 1 // HP filter
			this.f2.frequency.value = 10000;
				
			this.aeg5 = this.dsp.createGain();

			this.osc5.connect(this.f1);
			this.osc6.connect(this.f1);
			this.osc7.connect(this.f1);
			this.osc8.connect(this.f1);
			this.osc9.connect(this.f1);
			this.oscA.connect(this.f1);
			this.f1.connect(this.f2);	
			this.f2.connect( this.aeg5 );
			this.aeg5.connect( this.masterGain);

			//	GENERATE COWBELL
			this.oscB = this.dsp.createOscillator();
			this.oscB.type = 1; // square wave
			this.oscB.frequency.value = 900;

			this.oscC = this.dsp.createOscillator();
			this.oscC.type = 1; // square wave
			this.oscC.frequency.value = 1400;

			this.aeg6 = this.dsp.createGain();

			this.oscB.connect( this.aeg6 );
			this.oscC.connect( this.aeg6 );
			this.aeg6.connect(this.masterGain)

			// Fix FF
			//for legacy browsers
			//this.osc1.start = this.osc1.start || this.osc1.noteOn;
			//this.osc1.stop = this.osc1.stop || this.osc1.noteOff;

			
			// 	ROUTE SIGNALS - MIX AND OUTPUT
			this.masterGain.connect( this.dsp.destination );
			
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
			this.masterGain.gain = vol;
		}
		
		get volume( ):number
		{
			return this.masterGain.gain;
		}
		*/
		// TRIGGERS

		
		public bassdrum( l:number=2050, offsetA:number=0.005, offsetB:number=0.01, offsetC:number=0.7):void
		{
			var t = this.dsp.currentTime;
			
			this.aeg1.gain.cancelScheduledValues( t );
			this.aeg1.gain.setValueAtTime( 1, t );
			this.aeg1.gain.linearRampToValueAtTime( 1, 	t + offsetB );
			this.aeg1.gain.linearRampToValueAtTime( 0.0,  t + offsetC );

			this.osc1.frequency.setValueAtTime( l, t );
			this.osc1.frequency.exponentialRampToValueAtTime( 80, t + offsetA );
			
			console.log( this.osc1 );
			console.log( this.osc1.playbackState );
			
			//this.osc1.start(0);
		}

		public snare():void
		{
			var t = this.dsp.currentTime;
			
			//this.naeg.gain.cancelScheduledValues( t );
			this.naeg.gain.setValueAtTime(1, t);
			this.naeg.gain.linearRampToValueAtTime(1,  t + 0.025);
			this.naeg.gain.exponentialRampToValueAtTime(0.2, 	t + 0.050);
			this.naeg.gain.linearRampToValueAtTime(0.0,  t + 0.300);
				
			//this.noise.start(0);
		}

		public hihat():void
		{
			var t = this.dsp.currentTime;
			
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
			var t = this.dsp.currentTime;
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
			var t:number = this.dsp.currentTime;
			
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