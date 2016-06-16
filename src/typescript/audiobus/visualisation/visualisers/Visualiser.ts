/// <reference path="../../Dependencies.ts" />

/*

This is a base for all of the visualisers.

To view a visualiser, simply add the canvas element to the stage

*/

module audiobus.visualisation
{
	export class Visualiser
    {
		public context:CanvasRenderingContext2D;
		public canvas:HTMLCanvasElement;

		// Linked List
		public next:Visualiser;
		public previous:Visualiser;

		// create
		constructor()
		{

		}

		private createCanvas()
		{
			this.canvas = document.createElement("canvas");
			this.canvas.width = 256;
			this.canvas.height = 256;

			document.body.appendChild( this.canvas );

			this.context = this.canvas.getContext("2d");
		}
	}

}