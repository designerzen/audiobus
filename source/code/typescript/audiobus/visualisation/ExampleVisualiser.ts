/// <reference path="../Dependencies.ts" />
module audiobus.visualisation
{
    export class ExampleVisualiser
    {
        private analyser:audiobus.visualisation.SpectrumAnalyzer;

        private harmongraph:audiobus.visualisation.visualisers.Harmongraph;
        private bars:audiobus.visualisation.visualisers.Bars;
        private scope:audiobus.visualisation.visualisers.Scope;
        private plasma:audiobus.visualisation.visualisers.Plasma;

        private visualisers:Array<audiobus.visualisation.visualisers.Visualiser> = [];
        private activeVisualiser:audiobus.visualisation.visualisers.Visualiser;

        private counter:number = 0;
        private count:number = 1;

        private rainbow:Array<audiobus.visualisation.colour.Colour>;

        constructor( audioContext:AudioContext, source:GainNode, type:string=SpectrumAnalyzer.TYPE_FREQUENCY, fftSize:number=1024 )
		{
            this.analyser = new audiobus.visualisation.SpectrumAnalyzer( audioContext, type );

            var canvas = this.analyser.createCanvas( window.innerWidth,  window.innerHeight, 'visualiser' );
            this.rainbow = audiobus.visualisation.colour.Rainbows.colour();


            this.analyser.connect( audioContext.destination, source );
            this.analyser.setFidelity(fftSize);
            // add our visualissers
            this.harmongraph = new audiobus.visualisation.visualisers.Harmongraph();
            this.harmongraph.red = 0;
			this.harmongraph.green = 255;
			this.harmongraph.blue = 120;
            //this.harmongraph.createCanvas( 512, 512 );
            //this.harmongraph.appendSlave( new audiobus.visualisation.visualisers.Plasma() );
            //this.harmongraph.prependSlave( new audiobus.visualisation.visualisers.Plasma() );
            // now hook into our analyser for updates
            this.analyser.append( this.harmongraph );
            this.visualisers.push( this.harmongraph );


            this.bars = new audiobus.visualisation.visualisers.Bars();
            //this.analyser.append( bars );
            this.visualisers.push( this.bars );


            this.scope = new audiobus.visualisation.visualisers.Scope();
            //this.analyser.append( scope );
            this.visualisers.push( this.scope );

            this.plasma = new audiobus.visualisation.visualisers.Plasma();
            //this.analyser.append( scope );
            this.visualisers.push( this.plasma );


            this.counter = 0;
            this.activeVisualiser = this.visualisers[ this.counter ];
		}


        public start():void
        {
            this.analyser.onanalysis = (spectrum:Uint8Array) => { this.update(spectrum); };
			this.analyser.start();
        }


        public update(spectrum:Uint8Array):void
        {
            // and send the updates to the visualiser
            //console.log(this.activeVisualiser);
            switch (this.activeVisualiser)
            {
                case this.harmongraph:
                    var index:number = Math.round( this.count*0.5 )%255;
    				var colour:audiobus.visualisation.colour.Colour = this.rainbow[index];

                    // recolour
    				this.harmongraph.red = colour.red;
    				this.harmongraph.green = colour.green;
    				this.harmongraph.blue = colour.blue;

                    // rotate
                    this.harmongraph.zRatio = 1+(this.count++/1208)%1200;
                    this.harmongraph.xPhase += 0.0003;//
                    this.harmongraph.yPhase += 0.0002;//
                    this.harmongraph.zPhase += 0.0001;

                    break;

                case this.bars:

                    break;

                case this.scope:

                    break;
            }
        }

        // Goto the next visualiser!
        public next():void
        {
            this.counter = ( this.counter + 1 ) % this.visualisers.length;
            this.activeVisualiser = this.visualisers[ this.counter ];
            // connect
            this.analyser.solo( this.activeVisualiser );
            console.log( this.counter+"/"+this.visualisers.length+". activeVisualiser",this.activeVisualiser );
        }

	}
}