///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class HiHat extends Instrument
    {
		private osc5:OscillatorNode;
		private osc6:OscillatorNode;
		private osc7:OscillatorNode;
		private osc8:OscillatorNode;
		private osc9:OscillatorNode;
		private oscA:OscillatorNode;
		
		public f1:BiquadFilterNode;
		public f2:BiquadFilterNode;
	
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
			
			// Synthesize!
			
			//	GENERATE OSCILLATOR 5,6,7,8,9,A (square)		
			this.osc5 = audioContext.createOscillator();
			this.osc5.type = 1; // square wave
			this.osc5.frequency.value = 600;

			this.osc6 = audioContext.createOscillator();
			this.osc6.type = 1; // square wave
			this.osc6.frequency.value = 900;

			this.osc7 = audioContext.createOscillator();
			this.osc7.type = 1; // square wave
			this.osc7.frequency.value = 1300;

			this.osc8 = audioContext.createOscillator();
			this.osc8.type = 1; // square wave
			this.osc8.frequency.value = 2000;

			this.osc9 = audioContext.createOscillator();
			this.osc9.type = 1; // square wave
			this.osc9.frequency.value = 2300;

			this.oscA = audioContext.createOscillator();
			this.oscA.type = 1; // square wave
			this.oscA.frequency.value = 2800;

			this.f1 = audioContext.createBiquadFilter();
			this.f1.type = 1 // HP filter
			this.f1.frequency.value = 10000;
				
			this.f2 = audioContext.createBiquadFilter();
			this.f2.type = 1 // HP filter
			this.f2.frequency.value = 10000;
			
			this.osc5.connect(this.f1);
			this.osc6.connect(this.f1);
			this.osc7.connect(this.f1);
			this.osc8.connect(this.f1);
			this.osc9.connect(this.f1);
			this.oscA.connect(this.f1);
			
			this.f1.connect(this.f2);	
			this.f2.connect( this.gain );
		}
		
		// TRIGGERS
		public start():void
		{
			var t:number = this.context.currentTime;
			
			// noise gain
			//this.noiseGain.gain.setValueAtTime(0.2, t);
			//this.noiseGain.gain.linearRampToValueAtTime(0,  t + 0.025);
			
			this.f1.frequency.setValueAtTime(20, t);
			this.f1.frequency.linearRampToValueAtTime(16000, 	t + 0.050);
			this.f2.frequency.setValueAtTime(20, t);
			this.f2.frequency.linearRampToValueAtTime(16000, 	t + 0.050);
			
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(0.4, t);
			this.gain.gain.linearRampToValueAtTime(0.4,  t + 0.025);
			this.gain.gain.exponentialRampToValueAtTime(0.1, 	t + 0.050);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + 0.300);
			
			//noise.start(0);		
			if ( !this.hasInitialised )
			{
				this.osc5.start(0);
				this.osc6.start(0);
				this.osc7.start(0);
				this.osc8.start(0);
				this.osc9.start(0);
				this.oscA.start(0);
			}
			
			super.start();
		}
		
	}
}