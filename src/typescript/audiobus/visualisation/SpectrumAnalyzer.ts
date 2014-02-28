///<reference path="../definitions/waa.d.ts" />
//<reference path="visualisers/" />
module audiobus.visualisation
{
    export class SpectrumAnalyzer
    {
		public context:AudioContext;
		public gain:GainNode;
		public analyser:AnalyserNode;
		private sampleRate:number;
		public frequencyData:Uint8Array;
		
		constructor( audioContext:AudioContext, outputTo:GainNode )
		{
			this.context = audioContext;
			this.analyser = audioContext.createAnalyser();
			this.sampleRate = audioContext.sampleRate;

			// must be a power of two
			this.analyser.fftSize = 2048;
			//pipe to speakers
			this.analyser.connect(audioContext.destination);
			
			//create an empty array with 1024 items
			this.frequencyData = new Uint8Array(1024);

			this.gain = audioContext.createGain();
			this.gain.connect( outputTo );
			
			//connect to source
			this.gain.connect( this.analyser );
		}
		
		private update() {
			//constantly getting feedback from data
			this.analyser.getByteFrequencyData( this.frequencyData );
			// Schedule the next update
			requestAnimationFrame( this.update );
		}

	}
}