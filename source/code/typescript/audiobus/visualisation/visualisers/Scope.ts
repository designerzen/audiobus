import IVisualiser from './IVisualiser';
import Visualiser from './Visualiser';

export default class Scope extends Visualiser implements IVisualiser
{
  // Appearance
  public opacity:number 	= 255;
  public red:number 			= 55;
  public green:number 		= 55;	// 255
  public blue:number 			= 55;
  public thickness:number = 3;

	// create
	constructor()
  {
    super('Scope');
  }

  public update( spectrum:Uint8Array, time:number, bufferLength:number ):void
	{
		// clear screen in preProcess() :)
		this.context.lineWidth = this.thickness;
		this.context.strokeStyle = 'rgb(+'+this.red+','+this.green+','+this.blue +')';
		this.context.beginPath();

		var sliceWidth = this.width * 1.0 / bufferLength;
		var x:number = 0;

	  for(var i:number = 0; i < bufferLength; i++)
	  {
			var v:number = spectrum[i] / 128;
	    var y:number = v * this.centreY;

	    if(i === 0)
			{
	  		this.context.moveTo(x, y);
	    } else {
	  		this.context.lineTo(x, y);
	    }

	    x += sliceWidth;
	  }

		this.context.lineTo(this.width, this.centreY);
		this.context.stroke();

		//console.log( "Harmon Graph ", this.bitmapData );
	  super.update( spectrum, time, bufferLength );
	}

}
