/// <reference path="../../Dependencies.ts" />
/// <reference path="Visualiser.ts" />
/// <reference path="IVisualiser.ts" />
module audiobus.visualisation.visualisers
{
	export class Plasma extends Visualiser implements IVisualiser
    {
		private palette:Array<number>;
		private paletteReds:Array<number>;
		private paletteGreens:Array<number>;
		private paletteBlues:Array<number>;
		private sineTable:Array<number>;

		private pos1:number = 0;
		private pos2:number = 0;

		// create
		constructor()
		{
			super('Plasma');
			this.createTable();
		}

		private createTable():void
		{
			var i:number, r:number, g:number, b:number, rad:number;

			this.palette = new Array(); // 256
			this.paletteReds = new Array(); // 256
			this.paletteBlues = new Array(); // 256
			this.paletteGreens = new Array(); // 256

			this.sineTable = new Array(); // 512

			for (i = 0; i < 512; ++i)
			{
				rad = i * 0.703125 * 0.0174532;
				this.sineTable[i] = Math.sin(rad) * 1024;
			}

			for (i = 0; i < 64; ++i)
			{
				r = i << 2;
				g = 255 - ((i << 2) + 1);
				b = 0;
				this.palette[i] = r << 16 | g << 8 | b;
				this.paletteReds[i] = r;
				this.paletteGreens[i] = g;
				this.paletteBlues[i] = b;

				r = 255;
				g = (i << 2) + 1;
				this.palette[i + 64] = r << 16 | g << 8 | b;
				this.paletteReds[i + 64] = r;
				this.paletteGreens[i + 64] = g;
				this.paletteBlues[i + 64] = b;

				r = 255 - ((i << 2) + 1);
				g = r;
				b = 0;
				this.palette[i + 128] = r << 16 | g << 8 | b;
				this.paletteReds[i + 128] = r;
				this.paletteGreens[i + 128] = g;
				this.paletteBlues[i + 128] = b;

				r = 0;
				g = (i << 2) + 1;
				b = 0;
				this.palette[i + 192] = r << 16 | g << 8 | b;
				this.paletteReds[i + 192] = r;
				this.paletteGreens[i + 192] = g;
				this.paletteBlues[i + 192] = b;
			}
		}

		public update( spectrum:Uint8Array, time:number, bufferLength:number ):void
		{
			//this.canvas;
			var i:number, j:number, p:number, tp1:number, tp2:number, tp3:number, tp4:number;

			//this.bitmapData = this.context.getImageData(0,0,this.width, this.height);
			// Clear Screen();
    		// Clear the current transformation matrix
    		//this.bitmapData = this.context.createImageData(this.bitmapData);

			tp3 = this.pos2;
			//canvas.lock();

			for (i = 0; i < 360; ++i)
			{
				tp1 = this.pos1 + 5;
				tp2 = 3;
				tp3 &= 511;
				tp4 &= 511;

				for (j = 0; j < 480; ++j)
				{
					tp1 &= 511;
					tp2 &= 511;

					p = this.sineTable[tp1] + this.sineTable[tp2] + this.sineTable[tp3] + this.sineTable[tp4];
					p = (128 + (p >> 4)) & 255;

					//this.context.setPixel( j, i, this.palette[p] );
					//var c:number = this.palette[p];
					this.drawPixel( j, i, this.paletteReds[p], this.paletteGreens[p], this.paletteBlues[p] , 255 );

					tp1 += 5;
					tp2 += 3;
				}

				tp3++;
				tp4 += 3;
			}

			//canvas.unlock();

			this.pos1 += 9;
			this.pos2 += 8;

			// now copy this into all the places that need it...

			var columnX:number = 0;
			while ( columnX < this.width )
			{
				var rowY:number = 0;
				while ( rowY < this.height )
				{
					this.context.putImageData(this.bitmapData,columnX,rowY);
					rowY += 360;
				}
				columnX += 480;
			}

			super.update( spectrum, time, bufferLength );
		}
	}

}