module audiobus.visualisation.colour
{
	export class Colour
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
    }
}