package audiobus.views.components.text 
{
	import flash.text.StyleSheet;
	public class TextLabel extends AbstractTextLabel 
	{
		public function TextLabel($text:String, $fontSize:uint = 24, $textColour:int = 0xffffff, $horizontalPadding:Number = 16, $verticalPadding:Number = 6, $embedFont:Boolean = false, $fontName:String = "_sans", $css:StyleSheet=null) 
		{
			super( $text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName, $css );
		}
		
	}

}