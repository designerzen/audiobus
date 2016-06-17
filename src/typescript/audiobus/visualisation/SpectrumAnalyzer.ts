/// <reference path="../Dependencies.ts" />
module audiobus.visualisation
{
    export class SpectrumAnalyzer
    {
		private context:AudioContext;
		public gain:GainNode;
		public analyser:AnalyserNode;
		public frequencyData:Uint8Array;

        private running:boolean = false;
        private sampleRate:number;

        public onanalysis:Function = function(){};

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

            // Store
            this.analyser.getByteFrequencyData( this.frequencyData );
		}

        public start():void
        {
            this.running = true;
            this.update();
        }

        public stop():void
        {
            this.running = false;
        }

		private update():void
        {
			// Schedule the next update
			if (this.running)
            {
                //constantly getting feedback from data
    			this.analyser.getByteFrequencyData( this.frequencyData );
                // send out this data
                // this.frequencyData
    			if (this.onanalysis)
                {
                    this.onanalysis( this.frequencyData );
                }
                // go round another tine!
                requestAnimationFrame( () => this.update() );
                ///console.log("analyser::updated", this.update);
            }
		}

	}
}