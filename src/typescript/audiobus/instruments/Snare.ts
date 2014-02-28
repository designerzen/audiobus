///<reference path="../definitions/waa.d.ts" />
///<reference path="Instrument.ts" />
module audiobus.instruments
{
    export class Snare extends Instrument
    {
		private noise:AudioBufferSourceNode;
		private noiseBuffer:AudioBuffer;
		public noiseData:Float32Array;
		
		// create
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			super( audioContext, outputTo );
				
			//	GENERATE NOISE 
			this.noiseBuffer = audioContext.createBuffer(1, 22050, 22050);
			this.noiseData = this.noiseBuffer.getChannelData(0);
			
			for (var i = 0, l = this.noiseData.length; i < l ; ++i)
			{
				this.noiseData[i] = (Math.random() - 0.5) * 2;
			}
			
			this.noise = audioContext.createBufferSource();
			this.noise.loop = true;
			this.noise.buffer = this.noiseBuffer
			this.noise.connect( this.gain );
		}
		
		// trigger!
		public start( l:number=2050, offsetA:number=0.025, offsetB:number=0.050, offsetC:number=0.3):void
		{
			var t:number = this.context.currentTime;
			
			this.gain.gain.cancelScheduledValues( t );
			this.gain.gain.setValueAtTime(1, t);
			this.gain.gain.linearRampToValueAtTime(1,  t + offsetA);
			this.gain.gain.exponentialRampToValueAtTime(0.2, 	t + offsetB);
			this.gain.gain.linearRampToValueAtTime(0.0,  t + offsetC);
				
			this.noise.start(0);
		}
		
	}
	
}