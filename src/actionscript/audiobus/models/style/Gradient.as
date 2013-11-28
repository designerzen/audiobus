
/*/////////////////////////////////////////////////////////////////////////////////////////
 
VALUE OBJECT : This is just a way to specify gradient colours and directions and to
pass them into a shape.

/////////////////////////////////////////////////////////////////////////////////////////*/
package audiobus.models.style 
{
	import flash.geom.Matrix;
	
	public class Gradient 
	{
		public var colours:Array;
		public var opacities:Array;
		public var ratios:Array;
		public var angle:Number;
		public var matrix:Matrix;
		
		//////////////////////////////////////////////////////////////////////////////////
		// Constructor
		//////////////////////////////////////////////////////////////////////////////////
		public function Gradient( $colours:Array, $angle:Number=0, $opacities:Array=null, $ratios:Array=null ) 
		{
			// check to see if any of these arrays equate to null...
			if ( $opacities == null ) opacities = getDefaultOpacities( $colours.length );
			else opacities = $opacities;
			
			// Check to see if there are some ratios too...
			if ( $ratios == null ) ratios = getDefaultRatios( $colours.length );
			else ratios = $ratios;
			
			angle 	= $angle;
			colours = $colours;
		};
		
		//////////////////////////////////////////////////////////////////////////////////
		// Create the default Opacities!
		//////////////////////////////////////////////////////////////////////////////////
		private function getDefaultOpacities( $quantity:int ):Array
		{
			var opacities:Array = new Array();
			for ( var c:int = 0; c < $quantity ; ++c ) opacities[ opacities.length ] = 1;
			return opacities;
		};
		
		//////////////////////////////////////////////////////////////////////////////////
		// get the default ratios ( spread out )
		//////////////////////////////////////////////////////////////////////////////////
		private function getDefaultRatios( $quantity:int ):Array
		{
			var spacing:int = 255 / ($quantity-1);
			var ratios:Array = new Array();
			for ( var r:int = 0; r < $quantity ; ++r ) ratios[ ratios.length ] = spacing * r;
			return ratios;
		};
		
		//////////////////////////////////////////////////////////////////////////////////
		// Create a Matrix instance and assign the Gradient Box
		//////////////////////////////////////////////////////////////////////////////////
		public function getGradientMatrix( $width:Number, $height:Number ):Matrix
		{
			var matrix:Matrix = new Matrix();
			matrix.createGradientBox( $width, $height,  (Math.PI / 180) * angle, 0, 0 );
			return matrix;
		};
		
		
	}

}