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
        public opacity:number 		    = 0;
        public red:number 				= 0;
        public green:number 			= 255;	// 255
        public blue:number 				= 0;
        //var _thickness 		= 0.5;

        public sectionLength:number 	= 20;
        public deg2rad:number 		    = Math.PI/180;		// Factor to convert degs to radians

        private bitmapData:ImageData;

		// create
		constructor()
        {
            super();
        }

        private drawPixel( x:number, y:number, r:number, g:number, b:number, alpha:number ):void
    	{
    		x = x >> 0;
    		y = y >> 0;
    		var i:number = (x + y * this.bitmapData.width) * 4;
    		//console.log( "drawPixel x:"+x+" y:"+y+" i:"+i );
    		this.bitmapData.data[i+0] = r;
    		this.bitmapData.data[i+1] = g;
    		this.bitmapData.data[i+2] = b;
    		this.bitmapData.data[i+3] = alpha;
    	}

        public setCanvas(canvas:HTMLCanvasElement)
        {
            super.setCanvas(canvas);
            this.bitmapData	= this.context.getImageData(0, 0, this.width, this.height);
        }

        public update( spectrum:Uint8Array, time:number):void
    	{
    		// clear screen in preProcess() :)
    		var x:number, y:number, ox:number, oy:number;
    		var a:number = this.amplitude;
    		var s:number = 0;
    		var xp:number = this.xPhase;
    		var yp:number = this.yPhase;
    		var zp:number = this.zPhase;

    		// Clear Screen();
    		// Store the current transformation matrix
    		this.bitmapData = this.context.createImageData(this.bitmapData);

			// limit 1024
			var limit:number = 1024;
    		for (var t = 0; t < 5120; t++)
    		{
    			this.opacity = 1;//( t*0.2 )>>0;

    			//var level:number = (spectrum[ t%limit ] );//*0.5;
    			var level:number = (spectrum[ t%256 ] + 1);//*0.5;
    			//var level:number = (spectrum[ this.opacity ] + 1);//*0.5;
    			var sector :number = 2;//(spectrum[ t%256 ] + 1);//*0.5; level *
				//console.log("Harmongraph "+spectrum.length, level);

    			x = level * a * Math.sin(this.xRatio * t * this.deg2rad + xp) + a * Math.sin(this.zRatio * t * this.deg2rad + zp );
    			y = level * a * Math.sin(this.yRatio * t * this.deg2rad + yp);
    			// z = ;
    			a *= (1 - this.decay);

    			this.drawPixel( this.centreX + sector*x, this.centreY + sector* y, this.red, this.green, this.blue , this.opacity);

    			/*
    			if (s == 0)
    			{
    				// Create new line section


    				if (t == 0)
    				{
    					//_context.moveTo(x, y);
    					drawPixel( x, y, this.red, this.green, this.blue , this.opacity);
    				} else {
    					//_context.moveTo(ox, oy);
    					//_context.lineTo(x, y);
    					//drawPixel( ox, oy, this.red, this.green, this.blue , this.opacity);
    					drawPixel( x, y, this.red, this.green, this.blue , this.opacity);
    				}
    				//plot.addChild(l);
    			} else {
    				// Append to line section
    				//_context.lineTo(x, y);
    				drawPixel( x, y, this.red, this.green, this.blue , this.opacity);
    			}
    			ox = x;
    			oy = y;
    			*/

    			s++;

    			//console.log( "Harmon Graph "+s );
    			if (s == this.sectionLength) s = 0;
    		}

    		// draw shapes to canvas!
    		this.context.putImageData(this.bitmapData,0,0);
            super.update( spectrum, time );
    	}

    }
}