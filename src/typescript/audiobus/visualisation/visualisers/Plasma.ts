//<reference path="../../../definitions/waa.d.ts" />
///<reference path="Visualiser.ts" />
module audiobus.visualisation
{
	export class Plasma extends Visualiser
    {
		private var palette:Vector.<int>;
		private var sineTable:Vector.<int>;
		private var pos1:int;
		private var pos2:int;
		
		// create
		constructor( audioContext:AudioContext )
		{
			this.createTable();
			super( audioContext );
		}
		
		private createTable():void
		{
			var i:int, r:int, g:int, b:int, rad:number;

			palette = new Vector.<int>(256, true);
			sineTable = new Vector.<int>(512, true);

			for (i = 0; i < 512; ++i)
			{
				rad = i * 0.703125 * 0.0174532;
				sineTable[i] = Math.sin(rad) * 1024;
			}

			for (i = 0; i < 64; ++i) 
			{
				r = i << 2;
				g = 255 - ((i << 2) + 1);
				b = 0;
				palette[i] = r << 16 | g << 8 | b;

				r = 255;
				g = (i << 2) + 1;
				palette[i + 64] = r << 16 | g << 8 | b;

				r = 255 - ((i << 2) + 1);
				g = r;
				b = 0;
				palette[i + 128] = r << 16 | g << 8 | b;

				r = 0;
				g = (i << 2) + 1;
				b = 0;
				palette[i + 192] = r << 16 | g << 8 | b;
			}
		}
		
		public update( frequencyData:Uint8Array )
		{
			this.canvas;
			var i:int, j:int, p:int, tp1:int, tp2:int, tp3:int, tp4:int;

			tp3 = pos2;
			//canvas.lock();

			for (i = 0; i < 360; ++i) 
			{
				tp1 = pos1 + 5;
				tp2 = 3;
				tp3 &= 511;
				tp4 &= 511;

				for (j = 0; j < 480; ++j) 
				{
					tp1 &= 511;
					tp2 &= 511;

					p = sineTable[tp1] + sineTable[tp2] + sineTable[tp3] + sineTable[tp4];
					p = (128 + (p >> 4)) & 255;
					canvas.setPixel(j, i, palette[p]);

					tp1 += 5;
					tp2 += 3;
				}

				tp3++;
				tp4 += 3;
			}

			//canvas.unlock();

			pos1 += 9;
			pos2 += 8;		
		}
	}
	
}