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

		public width:number;
		public height:number;

		public centreX:number;
		public centreY:number;

		// Linked List
		public next:Visualiser;
		public previous:Visualiser;

		// create
		constructor()
		{

		}

		public createCanvas( width:number=256, height:number=256 )
		{
			this.canvas = document.createElement("canvas");
			this.canvas.width = width;
			this.canvas.height = height;

			document.body.appendChild( this.canvas );

			this.setCanvas( this.canvas );
		}

		public setCanvas(canvas:HTMLCanvasElement):void
		{
			this.canvas = canvas;
			this.context = this.canvas.getContext("2d");
			this.width = this.canvas.width;
			this.height = this.canvas.height;
			this.centreX = this.width / 2;
			this.centreY = this.height / 2;
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
		public update( spectrum:Uint8Array, time:number ):void
		{
			// call the next one on the list!
			if (this.next) this.next.update( spectrum, time );
		}
	}

}