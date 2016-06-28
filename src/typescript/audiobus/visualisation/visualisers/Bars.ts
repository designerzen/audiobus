/// <reference path="../../Dependencies.ts" />
/// <reference path="Visualiser.ts" />
/// <reference path="IVisualiser.ts" />

module audiobus.visualisation.visualisers
{
	export class Bars extends Visualiser implements IVisualiser
    {

        // Appearance
        public opacity:number 		    = 255;
        public red:number 				= 55;
        public green:number 			= 55;	// 255
        public blue:number 				= 55;
        //var thickness 		= 0.5;


		// create
		constructor()
        {
            super('Bars');
        }

        public update( spectrum:Uint8Array, time:number, bufferLength:number ):void
    	{
    		// clear screen in preProcess() :)
            //this.context.fillStyle = 'rgb(0, 0, 0)';
            //this.context.fillRect(0, 0, this.width, this.height);

            var barWidth:number = (this.width / bufferLength) * 2.5;
            var barHeight:number;
            var x:number = 0;

            for(var i:number = 0; i < bufferLength; i++)
            {
                barHeight = spectrum[i];

                this.context.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
                this.context.fillRect(x,this.height-barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

			//console.log( "Harmon Graph ", this.bitmapData );
            super.update( spectrum, time, bufferLength );
    	}

    }
}