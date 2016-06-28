/// <reference path="../Dependencies.ts" />
module audiobus.visualisation
{
    export class SpectrumAnalyzer
    {
        public now:Function = () => window.performance && window.performance.now ? window.performance.now() : Date.now();

        private audioContext:AudioContext;
        public analyser:AnalyserNode;
        public frequencyData:Uint8Array;

        private visualContext:CanvasRenderingContext2D;
        public canvas:HTMLCanvasElement;

        private running:boolean = false;
        private sampleRate:number;
        private type:string;

        public head:audiobus.visualisation.visualisers.Visualiser;
        public tail:audiobus.visualisation.visualisers.Visualiser;

        public onanalysis:Function = function(){};

        public static TYPE_FREQUENCY:string = "frequency";
        public static TYPE_TIME_DOMAIN:string = "fft";

		constructor( audioContext:AudioContext, type:string=SpectrumAnalyzer.TYPE_FREQUENCY, fftSize:number=1024 )
		{
            this.type = type;
			this.audioContext = audioContext;
			this.analyser = audioContext.createAnalyser();
            this.analyser.smoothingTimeConstant = 0.85;

			this.sampleRate = audioContext.sampleRate;

            // Store initial data
            this.setFidelity( fftSize );
		}

        public setFidelity( fftSize:number ):void
        {
            switch (this.type)
            {
                case SpectrumAnalyzer.TYPE_FREQUENCY:
                    this.analyser.fftSize = fftSize;   // must be a power of two
                    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
                    this.analyser.getByteFrequencyData( this.frequencyData );
                    break;

                case SpectrumAnalyzer.TYPE_TIME_DOMAIN:
                    this.analyser.fftSize = fftSize;    // must be a power of two
                    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
                    this.analyser.getByteTimeDomainData( this.frequencyData );
                    break;

            }
        }

        public connect( outputTo:AudioNode, source:AudioNode ):void
        {
            source.connect( this.analyser );
            this.analyser.connect( outputTo );
        }

        // As these effects can be chained together,
        // There should only be one canvas object per desired html element
        // This is passed and shared in all of the other visualisers
        public createCanvas( width:number=256, height:number=256, id:string='audiobus-visualiser' ):HTMLCanvasElement
        {
            this.canvas = document.createElement("canvas");
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.id = id;

            document.body.appendChild( this.canvas );

            this.setCanvas( this.canvas );
            return this.canvas;
        }

        // You can use the chain's siblings to pass this
        public setCanvas(canvas:HTMLCanvasElement):void
        {
            this.canvas = canvas;
            this.visualContext = this.canvas.getContext("2d");
        }

        // resizes canvas!
        public setSize():void
        {

        }

        // Add a visualiser as a slave effect that draws over this one!
        public append( slave:audiobus.visualisation.visualisers.Visualiser ):void
        {
            // check to see if there is a tail...
            if (!this.tail)
            {
                this.tail = this.head = slave;
                slave.setCanvas( this.canvas );
                return;
            }

            // find the tail and add to it
            this.tail.next = slave;
            slave.previous = this.tail;
            this.tail = slave;

            slave.setCanvas( this.canvas );
            console.error( slave );
        }

        public prepend( slave:audiobus.visualisation.visualisers.Visualiser ):void
        {
            if (!this.head)
            {
                this.tail = this.head = slave;
                slave.setCanvas( this.canvas );
                return;
            }

            // find the tail and add to it
            // find the tail and add to it
            this.head.previous = slave;
            slave.next = this.head;
            this.head = slave;
            slave.setCanvas( this.canvas );
            console.error( 'prependSlave', slave );
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
                if (this.type === SpectrumAnalyzer.TYPE_FREQUENCY)
                {
                    this.analyser.getByteFrequencyData( this.frequencyData );
                }else{
                    this.analyser.getByteTimeDomainData( this.frequencyData );
                }

                // call all registered visualisers
                var vis:audiobus.visualisation.visualisers.Visualiser = this.head;
                if (vis)
                {
                    // clear if neccessary
                    this.visualContext.fillStyle = 'rgb(0, 0, 0)';
                    this.visualContext.fillRect(0, 0, vis.width, vis.height);

                    while (vis)
                    {
                        vis.update( this.frequencyData, this.now(), this.analyser.frequencyBinCount );
                        vis = vis.next;
                    }
                }

                // send out this data
                // this.frequencyData
    			if (this.onanalysis)
                {
                    this.onanalysis( this.frequencyData );
                }
                // go round another tine!
                requestAnimationFrame( () => this.update() );
                //console.log("analyser::updated",this.frequencyData);
            }
		}

	}
}