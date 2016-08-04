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
        public rainbow:Array<audiobus.visualisation.colour.Colour>;
        //var thickness 		= 0.5;

		constructor()
        {
            super('Bars');
        }

        public update( spectrum:Uint8Array, time:number, bufferLength:number ):void
    	{
    		// clear screen in preProcess() :)
            //this.context.fillStyle = 'rgb(0, 0, 0)';
            //this.context.fillRect(0, 0, this.width, this.height);
			if (!this.rainbow)
			{
				//this.rainbow = audiobus.visualisation.colour.Rainbows.colour( 0.3, 0.3, 0.3,0, 2, 4, (bufferLength/2)>>0,1+(bufferLength/2)>>0, bufferLength );
				this.rainbow = audiobus.visualisation.colour.Rainbows.colour();
			}
            var barWidth:number = (this.width / bufferLength);// * 2.5;
            var barHeight:number;
            var x:number = 0;
			var colour:audiobus.visualisation.colour.Colour;

            for(var i:number = 0; i < bufferLength; i++)
            {
				var percent:number = i/bufferLength;
				var block:number = (percent * 255)>>0;
				colour = this.rainbow[block];
                barHeight = spectrum[i];
				//console.log( colour.toString() );

                this.context.fillStyle = colour.toRGBA(barHeight+100);//'rgb(' + (barHeight+100) + ',50,50)';
                //this.context.fillStyle = colour.toRGB();//'rgb(' + (barHeight+100) + ',50,50)';
                this.context.fillRect(x,this.height-barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

			//console.log( "Harmon Graph ", this.bitmapData );
            super.update( spectrum, time, bufferLength );
    	}

    }
}