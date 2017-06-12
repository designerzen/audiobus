package audiobus.views.components.text 
{
	import flash.text.GridFitType;
	import flash.text.TextFieldAutoSize;
	import flash.text.TextFormat;
	import flash.text.TextField;

	public class CentredTextLabel extends AbstractTextLabel 
	{
		override public function get width():Number 
		{
			return super.textfield.width;// + super.hor;
		}
		
		override public function set width(value:Number):void 
		{
			super.textfield.width = value;
		}
		
		public function get textWidth():Number
		{
			return super.textfield.textWidth;
		}
		
		public function CentredTextLabel($text:String, $fontSize:uint=24, $textColour:int=0xffffff, $horizontalPadding:Number=16, $verticalPadding:Number=6, $embedFont:Boolean=false, $fontName:String="_sans") 
		{
			super($text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName );
			super.textfield.gridFitType = GridFitType.SUBPIXEL;
		}
		
		override protected function createLabel( $textFormat:TextFormat, $embeddedFont:Boolean = false ):TextField 
		{
			var tf:TextField = super.createLabel($textFormat, $embeddedFont);
			tf.autoSize = TextFieldAutoSize.CENTER;
			return tf;
		}
		
	}

}