///<reference path="../../../definitions/waa.d.ts" />
///<reference path="visualisers/" />
module audiobus.visualisation
{
	export class Visualiser
    {
		static context(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
		
		public var context;
		
		// create
		constructor( audioContext:AudioContext )
		{
			this.context = audioContext;
		}
		
		private createCanvas()
		{
			this.canvas = document.createElement("canvas");
			this.canvas.width = 256;
			this.canvas.height = 256;
			
			document.body.appendChild( this.canvas );
			
			this.context = canv.getContext("2d");
		}
	}
	
}