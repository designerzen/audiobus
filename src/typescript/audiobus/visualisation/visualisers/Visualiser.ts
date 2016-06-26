/// <reference path="../../Dependencies.ts" />
/// <reference path="IVisualiser.ts" />

/*

This is a base for all of the visualisers.

To view a visualiser, simply add the canvas element to the stage

*/

module audiobus.visualisation.visualisers
{
	export class Visualiser implements IVisualiser
    {
		public context:CanvasRenderingContext2D;
		public canvas:HTMLCanvasElement;
		public bitmapData:ImageData;

		public name:string = 'Visualiser';
		public width:number;
		public height:number;

		public centreX:number;
		public centreY:number;

		// Linked List
		public next:Visualiser;
		public previous:Visualiser;

		public master:boolean = false;	// is this the main vis?

		// create
		constructor( title:string )
		{
			this.name = title;
		}

		// As these effects can be chained together,
		// There should only be one canvas object per desired html element
		// This is passed and shared in all of the other visualisers
		public createCanvas( width:number=256, height:number=256 ):void
		{
			this.canvas = document.createElement("canvas");
			this.canvas.width = width;
			this.canvas.height = height;

			document.body.appendChild( this.canvas );

			this.setCanvas( this.canvas );
		}

		// You can use the chain's siblings to pass this
		public setCanvas(canvas:HTMLCanvasElement):void
		{
			this.canvas = canvas;
			this.context = this.canvas.getContext("2d");
			this.width = this.canvas.width;
			this.height = this.canvas.height;
			this.centreX = this.width / 2;
			this.centreY = this.height / 2;
			this.bitmapData	= this.context.getImageData(0, 0, this.width, this.height);
		}

		public toString():string
		{
			var vis:Visualiser = this;
			var counter:number = 1;
			var output:string = 'Visualisers'+'\n';
			while (vis.previous)
			{
				vis = vis.previous;
				output += (counter++) + '. name: '+vis.name+'\n';

			}
			vis = this;
			output += (counter++) + '. name: **'+vis.name+'**'+'\n';
			while (vis.next)
			{
				vis = vis.next;
				output += (counter++) + '. name: '+vis.name+'\n';

			}

			return output;
		}

		// Ways to combine multiple effects on top of each other
		public unlink():Visualiser
		{
			if (this.previous && this.next)
			{
				// in a chain
				this.previous.next = this.next;
				this.next.previous = this.previous;

			} else if (!this.previous && this.next) {

				// at the top of the chain
				this.next.previous = this.previous;

			} else if (this.previous && !this.next) {

				// at the bottom odf the chain
				this.previous.next = this.next;

			} else if (!this.previous&&!this.next) {

				// already an orphan ;(
			}
			return this;
		}

		// This loops through all visualisers and
		// uses this canvas as the basis for the others
		public setAsMaster():Visualiser
		{
			var vis:Visualiser = this;
			var head:Visualiser = this;
			var tail:Visualiser = this;
			// go up from here...
			while (vis.previous)
			{
				vis = vis.previous;
				vis.master = false;
				vis.setCanvas( this.canvas );
				head = vis;
			}
			vis = this;
			// back down
			while (vis.next)
			{
				vis = vis.next;
				vis.master = false;
				vis.setCanvas( this.canvas );
				tail = vis;
			}

			this.master = true;
			console.error(head,tail);
			return this;
		}

		// Add a visualiser as a slave effect that draws over this one!
		public appendSlave( slave:Visualiser ):Visualiser
		{
			// find the tail and add to it
			var vis:Visualiser = this;
			while (vis.next)
			{
				vis = vis.next;
			}
			vis.next = slave;
			slave.previous = vis;
			slave.setCanvas( this.canvas );
			console.error( vis );
			return this;
		}

		public prependSlave( slave:Visualiser ):Visualiser
		{
			// find the tail and add to it
			var vis:Visualiser = this;
			while (vis.previous)
			{
				vis = vis.previous;
			}
			vis.previous = slave;
			slave.next = vis;
			slave.setCanvas( this.canvas );
			console.error( 'prependSlave',vis.previous );
			return this;
		}

		// Manipulation ========================================
		public drawPixel( x:number, y:number, r:number, g:number, b:number, alpha:number ):void
    	{
    		x = x >>0 ;//Math.round(x);
    		y = y>>0;//Math.round(y);
    		var i:number = (x + y * this.width) * 4;
    		//var i:number = (y*(this.width*4)) + (x*4);
    		//console.log( "drawPixel x:"+x+" y:"+y+" i:"+i );
    		this.bitmapData.data[i+0] = r;
    		this.bitmapData.data[i+1] = g;
    		this.bitmapData.data[i+2] = b;
    		this.bitmapData.data[i+3] = alpha;
			//console.log(i,x,y,r,g,b,alpha);
    	}

		// clears the canvas with the specified colour
		public clearScreen():void
		{
			// Store the current transformation matrix
			this.context.save();

			// Use the identity matrix while clearing the canvas
			this.context.setTransform(1, 0, 0, 1, 0, 0);
			this.context.clearRect(0, 0, this.width, this.height);

			// Restore the transform
			this.context.restore();
		}

		// This will render the visualiser...
		// Pass in frequency data from the Spectrum Analyser
		// It will call all subsequent effects in the chain
		public update( spectrum:Uint8Array, time:number ):void
		{
			// call the next one on the list!
			if (this.next)
			{
				this.next.update( spectrum, time );
			}
		}
	}

}