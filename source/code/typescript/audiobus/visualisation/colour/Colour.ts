export default class Colour
{
  public red:number;
  public green:number;
  public blue:number;

  constructor( r:number, g:number, b:number )
  {
    this.red = r >> 0;
    this.green = g >> 0;
    this.blue = b >> 0;
  }

	public toRGB():string
	{
		return 'rgb(' + this.red + ','+this.green+','+this.blue+')';
	}
	
	public toRGBA( alpha:number ):string
	{
		return 'rgba(' + this.red + ','+this.green+','+this.blue+','+alpha+')';
	}

	public toString():string
	{
		return "#" + ((1 << 24) + (this.red << 16) + (this.green << 8) + this.blue).toString(16).slice(1);
	}
}
