// FIXED Width
package audiobus.views.components.text 
{
	import flash.text.AntiAliasType;
	import flash.text.StyleSheet;
	import flash.text.TextField;
	import flash.text.TextFieldAutoSize;
	import flash.text.TextFormat;

	public class TextBlock extends AbstractTextLabel 
	{
		private var floodFillBackground:Boolean = false;
		private var visibleWidth:Number;
		
		public function TextBlock( $text:String, $width:Number, $fontSize:uint=24, $textColour:int=0xffffff, $horizontalPadding:Number=16, $verticalPadding:Number=6, $embedFont:Boolean=false, $fontName:String="_sans", $css:StyleSheet=null) 
		{
			visibleWidth = $width;
			super($text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName, $css );
		}
		
		public function set backgroundFloodFill( $value:Boolean ):void 
		{
			floodFillBackground = $value;
			updateBackground();
			//trace("backgroundFloodFill"+$value);
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Creates a simple textfield to specific sizes
		/////////////////////////////////////////////////////////////////////////////////////////////
        override protected function createLabel( $textFormat:TextFormat, $embeddedFont:Boolean=false ):TextField 
		{
            var tf:TextField = super.createLabel( $textFormat, $embeddedFont );
			tf.multiline = true;
			tf.wordWrap = true;
			tf.width = visibleWidth - ( super.paddingX * 2);
			//tf.mouseEnabled = 
			tf.mouseWheelEnabled = false;
			return tf;
        };
		
		 override protected function generateBackgroundWidth():Number
		{
			return ( floodFillBackground ) ? visibleWidth : textfield.textWidth + super.paddingX * 2;
		}
	}

}