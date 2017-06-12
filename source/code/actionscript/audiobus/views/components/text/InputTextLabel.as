package audiobus.views.components.text 
{
	import flash.events.Event;
	import flash.text.AntiAliasType;
	import flash.text.StyleSheet;
	import flash.text.TextField;
	import flash.text.TextFieldAutoSize;
	import flash.text.TextFieldType;
	import flash.text.TextFormat;
	
	public class InputTextLabel extends AbstractTextLabel 
	{
		public function get maxChars():int
		{
			return super.textfield.maxChars;
		}
		
		public function set maxChars( $value:int ):void
		{
			super.textfield.maxChars = $value;
		}
		
		public function InputTextLabel( $text:String, $fontSize:uint = 24, $textColour:int = 0xffffff, $horizontalPadding:Number = 16, $verticalPadding:Number = 6, $maxWidth:Number=200, $embedFont:Boolean = false, $fontName:String = "_sans", $css:StyleSheet=null) 
		{
			super( $text, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName , $css );
			
			super.textfield.addEventListener( Event.CHANGE, onTextChanged );
           
			// super.textfield.addEventListener(KeyboardEvent.KEY_DOWN,handler );
		    /**/
		    
			
			super.textfield.width	= $maxWidth;
		//	super.textfield.height	= 100;
		}
			
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Creates a simple textfield to specific sizes
		/////////////////////////////////////////////////////////////////////////////////////////////
        protected override function createLabel( $textFormat:TextFormat, $embeddedFont:Boolean=false ):TextField 
		{
            var tf:TextField = new TextField();
            tf.autoSize = TextFieldAutoSize.LEFT;			// Auto resize the label with the text, aligning to the left
			tf.antiAliasType = AntiAliasType.ADVANCED;		// Set the text to CRISP mode for readability
			tf.selectable = true;  							// We want this to be highlightable via the mouse
			tf.background = false;							// We don't want no lousy background!
			tf.embedFonts = $embeddedFont;					// Embed font (required for alpha masking etc...)
			tf.border = false;								// Kill the border on this field
			tf.defaultTextFormat = $textFormat;				// Set the textformat to the textfield
			
			tf.type = TextFieldType.INPUT;
			tf.multiline = true;
			tf.wordWrap = true;
			
			
			return tf;										// return this textfield to add to our Sprite
        };
		
		
		private function onTextChanged( $e:Event ):void 
		{
			super.textfield;//
			// redraw background :)
			 updateBackground();
		}
		
	}

}