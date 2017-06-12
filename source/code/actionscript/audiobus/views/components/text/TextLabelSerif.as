package audiobus.views.components.text 
{
	public class TextLabelSerif extends AbstractTextLabel
	{
		
		public function TextLabelSerif($text:String, $fontSize:uint = 24, $textColour:int = 0xffffff, $horizontalPadding:Number = 16, $verticalPadding:Number = 6 ) 
		{
			super($text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, false, "_serif");
			
		}
		
	}

}