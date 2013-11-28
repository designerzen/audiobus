/*/////////////////////////////////////////////////////////////////

This is a super class sprite that allows us to draw text fields
in order to decorate them at a later date. 

The parameters are set up to handle lazy initialisation :D

/////////////////////////////////////////////////////////////////*/
package audiobus.views.components.text 
{
	import flash.display.Sprite;
	import flash.events.TextEvent;
	import flash.text.GridFitType;
	import flash.text.StyleSheet;
	import flash.text.TextField;
	
	import flash.text.TextFieldAutoSize;
    import flash.text.TextFormat;
	import flash.text.AntiAliasType;
	
	public class AbstractTextLabel extends Sprite
	{
		protected var textfield:TextField;
				
		private var currentFont:String 		= "sans";
		private var currentFontSize:Number 	= 0;
		private var currentFontColour:uint 	= 0;
		
		protected var paddingX:Number 		= 0;
		protected var paddingY:Number 		= 0;

		private var background:Background;
		
		public function get textField():TextField
		{
			return textfield;
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the text in the field 
		/////////////////////////////////////////////////////////////////////////////////////////////		
        public function get text(): String {	return textfield.text;	};	
		public function set text( $string:String ):void 
		{
			textfield.text = $string;
        }
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the text in the field 
		/////////////////////////////////////////////////////////////////////////////////////////////		
		public function get htmlText(): String {	return textfield.htmlText;	};	
		public function set htmlText( $html:String ):void 
		{
			textfield.htmlText = $html;
        }
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the text colour in the field
		/////////////////////////////////////////////////////////////////////////////////////////////			
		public function get textColour(  ):uint { return currentFontColour;  };
		public function set textColour( $textColour:uint ):void
		{
			setTextColour( $textColour );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the text colour in the field
		/////////////////////////////////////////////////////////////////////////////////////////////			
		public function get fontSize():int {	return currentFontSize;	};	
		public function set fontSize( $fontSize:int ):void
		{
			var textFormat:TextFormat = textfield.getTextFormat();
			textFormat.size = $fontSize;
			textfield.setTextFormat( textFormat );
			currentFontSize = $fontSize;
		};
		
		public function set styleSheet( $styleSheet:StyleSheet ):void
		{
			var tempText:String = textfield.htmlText;
			textfield.styleSheet = $styleSheet;
			textfield.htmlText = tempText;
		}
		
		// fetch textformat
		public function set leading( $leading:Number ):void 
		{
			var tempFormat:TextFormat = textfield.getTextFormat();
			tempFormat.leading = $leading;
			textfield.setTextFormat( tempFormat );
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the font in this textfield
		/////////////////////////////////////////////////////////////////////////////////////////////			
		public function set font( $fontName:String ):void
		{
			setFont( $fontName, false );
		}
		public function set embeddedFont( $fontName:String ):void
		{
			setFont( $fontName, true );
		};
		
		// ============================================================================
		
		public function AbstractTextLabel ( $text:String, $fontSize:uint = 24, $textColour:int = 0xffffff, $horizontalPadding:Number = 16, $verticalPadding:Number = 6, $embedFont:Boolean = false, $fontName:String ="_sans", $css:StyleSheet=null	) 
		{
			var textFormat:TextFormat = createTextFormat( $fontName, $fontSize, $textColour );

			
			// save settings
			currentFontSize 	= $fontSize;
			currentFontColour 	= $textColour;
			currentFont			= $fontName;
			
			// save positioning
			paddingX 			= $horizontalPadding;
			paddingY 			= $verticalPadding;
	
			
			//trace( "text : " + $text);
			
			// create textfield and set text format
			textfield 			= createLabel( textFormat, $embedFont );
            if ( $css ) 
			{
				this.styleSheet = $css;
				textfield.htmlText	= $text;	
			
			}else {
				textfield.text	= $text;
			}
			

			// move textfield into position ( give it some padding )
            setLabelPosition( );											
			
			// invisible border for now
			//drawBackground( 0, 0 );
			
			// add our sprites to the stage
			addChildAt( textfield, 0 );
		};
		
		public function focus():void
		{
			stage.focus = textfield;
			textfield.setSelection(0, textfield.text.length);
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Sets the font for the text field
		/////////////////////////////////////////////////////////////////////////////////////////////			
		public function setFont( $fontName:String = "_sans", $embedFont:Boolean=true ):void
		{
			var textFormat:TextFormat 		= textfield.getTextFormat();
			textFormat.font					= $fontName;
			textfield.embedFonts            = $embedFont;
			textfield.setTextFormat( textFormat );
			currentFont						= $fontName;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Sets the text colour in the field
		/////////////////////////////////////////////////////////////////////////////////////////////			
		protected function setTextColour( $textColour:int=0xffffff ):void
		{
			var textFormat:TextFormat 	= textfield.getTextFormat();
			textFormat.color 			= $textColour;
			currentFontColour 			= $textColour;
			textfield.setTextFormat( textFormat );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Pad the textfield
		/////////////////////////////////////////////////////////////////////////////////////////////
	    protected function setLabelPosition():void 
		{			
			var newXPosition:int = Math.floor( paddingX );
			var newYPosition:int = Math.floor( paddingY );
			
			/*
			if (newXPosition > 12) newXPosition -= 2;	// -2;	// to compensate for line leading we -2 pixels
			if (newYPosition > 12) newYPosition -= 2;	// -2;	// to compensate for line leading we -2 pixels
			*/
			
			textfield.x = newXPosition; 
			textfield.y = newYPosition; 
        };
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Creates a simple textfield to specific sizes
		/////////////////////////////////////////////////////////////////////////////////////////////
        protected function createLabel( $textFormat:TextFormat, $embeddedFont:Boolean=false ):TextField 
		{
            var tf:TextField = new TextField();
            tf.autoSize = TextFieldAutoSize.LEFT;			// Auto resize the label with the text, aligning to the left
			tf.antiAliasType = AntiAliasType.ADVANCED;		// Set the text to CRISP mode for readability
			tf.selectable = false;  						// We don't want this to be highlightable via the mouse
			tf.condenseWhite = true;						// As it is for a single line, lets trim the whitespace
			tf.background = false;							// We don't want no lousy background!
			tf.embedFonts = $embeddedFont;					// Embed font (required for alpha masking etc...)
			tf.border = false;								// Kill the border on this field
			tf.defaultTextFormat = $textFormat;				// Set the textformat to the textfield
			
			return tf;										// return this textfield to add to our Sprite
        };
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//	Draw a background behind the text (with rounded corners if specified)
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function drawBackground( $colour:uint=0x000000, $opacity:Number=1, $topLeftRadius:Number=0, $topRightRadius:Number=0, $bottomLeftRadius:Number=0, $bottomRightRadius:Number=0 ):void
		{
			if ( !background )
			{
				background = new Background( super.graphics );
			}
			
			background.draw( generateBackgroundWidth(), generateBackgroundHeight(), $colour, $opacity, $topLeftRadius, $topRightRadius, $bottomLeftRadius, $bottomRightRadius );
		}
		
		public function updateBackground( $colour:Number=-1 ):void
		{
			if ( background ) background.redraw( generateBackgroundWidth(), generateBackgroundHeight(), $colour ); 
		}
		
		protected function createTextFormat( $fontName:String ="_sans", $fontSize:uint=24, $textColour:int=0xffffff,  $bold:Boolean=false, $italic:Boolean=false, $underline:Boolean=false ):TextFormat
		{
			return new TextFormat( $fontName, $fontSize, $textColour, $bold, $italic, $underline );
		}
		
		protected function generateBackgroundWidth():Number
		{
			return textfield.textWidth + paddingX * 2;
		}
		protected function generateBackgroundHeight():Number
		{
			return textfield.height + paddingY * 2;
		}
	}
}

import flash.display.Graphics;

internal class Background
{
	private var graphics:Graphics;
	
	private var colour:uint;
	private var opacity:Number;
	private var topLeftRadius:Number;
	private var topRightRadius:Number;
	private var bottomLeftRadius:Number;
	private var bottomRightRadius:Number;
	
	public function Background( $graphics:Graphics )
	{
		graphics = $graphics;
	}
	
	public function draw( $width:Number, $height:Number, $colour:uint=0x000000, $opacity:Number=1, $topLeftRadius:Number=0, $topRightRadius:Number=0, $bottomLeftRadius:Number=0, $bottomRightRadius:Number=0 ):void
	{
		colour = $colour;
		opacity = $opacity;
		topLeftRadius = $topLeftRadius;
		topRightRadius = $topRightRadius;
		bottomLeftRadius = $bottomLeftRadius;
		bottomRightRadius = $bottomRightRadius;
		
		create( $width, $height );
	}
	
	public function redraw( $width:Number, $height:Number, $colour:Number=-1 ):void
	{
		if ( $colour > -1 ) colour = $colour;
		create( $width, $height );
	}
	
	private function create( $width:Number, $height:Number ):void
	{
		graphics.clear();
		graphics.beginFill( colour, opacity );
		graphics.drawRoundRectComplex( 0, 0, $width, $height, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius );
		graphics.endFill();
	}
}