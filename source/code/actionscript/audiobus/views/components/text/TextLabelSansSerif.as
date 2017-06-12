package audiobus.views.components.text 
{
	public class TextLabelSansSerif extends AbstractTextLabel
	{
		
		public function TextLabelSansSerif($text:String, $fontSize:uint = 24, $textColour:int = 0xffffff, $horizontalPadding:Number = 16, $verticalPadding:Number = 6) 
		{
			super($text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, false, "_sans");
			
		}
		
	}

}