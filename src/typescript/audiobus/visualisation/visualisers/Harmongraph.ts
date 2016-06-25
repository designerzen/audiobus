/// <reference path="../../Dependencies.ts" />
/// <reference path="Visualiser.ts" />
/// <reference path="IVisualiser.ts" />

module audiobus.visualisation.visualisers
{
	export class Harmongraph extends Visualiser implements IVisualiser
    {
        public xRatio:number 		= 3;
        public xPhase:number 		= 0;

        public yRatio:number 		= 2;
        public yPhase:number 		= 0;

        public zRatio:number 		= 3;
        public zPhase:number 		= 0;

        public amplitude:number 		 = 150;
    //    public _iterations:number 	     = 5120;

        public decay:number 			= 2/10000;

        // Appearance
        public opacity:number 		    = 255;
        public red:number 				= 128;
        public green:number 			= 128;	// 255
        public blue:number 				= 128;
        //var _thickness 		= 0.5;

        public sectionLength:number 	= 20;
        public deg2rad:number 		    = Math.PI/180;		// Factor to convert degs to radians


		// create
		constructor()
        {
            super('Harmongraph');
        }

        public update( spectrum:Uint8Array, time:number):void
    	{
    		// clear screen in preProcess() :)
    		var x:number, y:number;
    		var a:number = this.amplitude;
    		var s:number = 0;
			var alpha:number = this.opacity;

    		// Clear Screen();
    		// Clear the current transformation matrix
    		this.bitmapData = this.context.createImageData(this.bitmapData);

			// reuse
			//this.bitmapData = this.context.getImageData(0,0,this.width, this.height);
			//var data = this.bitmapData.data.length;

			// limit 1024
			var limit:number = 1024;
			var quantity:number = limit*4;
    		for (var t = 0; t < quantity; ++t)
    		{
    			//this.opacity = 1;//( t*0.2 )>>0;

    			var level:number = 1+(spectrum[ t%limit ]/255 );//*0.5;
				// if (level > 0) console.log('level:'+level);
    			//var level:number = (spectrum[ t%256 ] + 1);//*0.5;
    			//var level:number = (spectrum[ this.opacity ] + 1);//*0.5;
    			var sector :number = 1;//(spectrum[ t%256 ] + 1);//*0.5; level *
				//console.log("Harmongraph "+spectrum.length, level);

    			x = level * a * Math.sin(this.xRatio * t * this.deg2rad + this.xPhase) + a * Math.sin(this.zRatio * t * this.deg2rad + this.zPhase );
    			y = level * a * Math.sin(this.yRatio * t * this.deg2rad + this.yPhase);
    			// z = ;
    			a *= (1 - this.decay);

    			this.drawPixel( this.centreX + sector*x, this.centreY + sector* y, this.red, this.green, this.blue , alpha);

    			s++;

    			//console.log( "Harmon Graph "+s );
    			if (s == this.sectionLength) s = 0;
    		}
//console.log(spectrum);
    		// draw shapes to canvas!
    		this.context.putImageData(this.bitmapData,0,0);
			//console.log( "Harmon Graph ", this.bitmapData );
            super.update( spectrum, time );
    	}

    }
}