package audiobus.views.components.text 
{
	import etc.ConfigBehaviour;
	import etc.ConfigColours;
	import etc.ConfigDimensions;
	import flash.events.Event;
	import flash.events.FocusEvent;
	import flash.text.StyleSheet;
	import flash.text.TextFieldType;
	import flash.text.TextFormat;
	import flash.text.TextField;
	
	public class PriceLabel extends QuantityLabel 
	{
		static public const ON_PRICE_UPDATED:String = "onPriceUpdated";
		
		// two labels in one!
		private var currency:String = "£";
		private var value:int;
		private var isEdittable:Boolean;
		private var currencyLabel:TextLabel;
		private var visibleWidth:int;
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// Set price in pennies. Text is formatted to show commas and currency.
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function set price( $price:Number ):void
		{
			//trace( "Setting price to "+$price );
			value = $price;
			this.text = formatText( $price );
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// Return the set price as a whole number of pennies
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function get price():Number
		{
			var output:int = Number( value );
			return output;
		}
				
		/////////////////////////////////////////////////////////////////////////////////////////////
		// Return the set price as a whole number of pennies
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function get entry():Number
		{
			return Number( value );
		}
		
		public function set edittable( $edittable:Boolean ):void
		{
			isEdittable = $edittable;
			if ($edittable)
			{
				textfield.type = TextFieldType.INPUT;
				textfield.addEventListener( Event.CHANGE, onPriceChange );
				textfield.addEventListener( FocusEvent.FOCUS_IN, onSelected );
				this.mouseChildren = false;
				this.useHandCursor = true;
				this.buttonMode = true;
			} else {
				textfield.type = TextFieldType.DYNAMIC;
				this.mouseChildren = true;
				this.useHandCursor = false;
				this.buttonMode = false;
			}
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// sweet !
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function PriceLabel( $price:Number, $width:int, $fontSize:uint=24, $currencyFontSize:uint=12, $textColour:int=0xffffff, $horizontalPadding:Number=16, $verticalPadding:Number=6, $inputText:Boolean= false, $embedFont:Boolean=false, $fontName:String="_sans", $currency:String = "£", $css:StyleSheet=null ) 
		{
			currency = $currency;
			isEdittable = $inputText;
			visibleWidth = $width;
			
			//trace( "Setting Price Label To "+$price );
			
			//if ( $price < 0 ) $price = 0;
			
			super( $price, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName, $css );
			this.price = $price;
			//trace( "Setting Price Label To this.price : "+this.price+ " value : " + value );
			
			if ( isEdittable )
			{
				// here we add in some extra loveliness to make this seem like an input box
				super.drawBackground( ConfigColours.WHITE, 1, ConfigDimensions.ROUNDED_CORNER_RADIUS_SMALL, ConfigDimensions.ROUNDED_CORNER_RADIUS_SMALL, ConfigDimensions.ROUNDED_CORNER_RADIUS_SMALL, ConfigDimensions.ROUNDED_CORNER_RADIUS_SMALL );
				this.edittable = true;
				
			}
			
			currencyLabel = new TextLabel( currency, $currencyFontSize, textColour, 0, 0, $embedFont, $fontName );
			addChild( currencyLabel );
			textfield.x = currencyLabel.x + currencyLabel.width;
			currencyLabel.y =  (textfield.height) - (currencyLabel.height ) - 1;
		}
		
		private function onPriceChange(e:Event):void 
		{
			value =	int( this.text );
			dispatchEvent( new Event(ON_PRICE_UPDATED) );
		}
		
		private function onSelected( $event:FocusEvent ):void 
		{
			$event.target.setSelection(0, $event.target.text.length);
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////////////////
		override protected function createLabel($textFormat:TextFormat, $embeddedFont:Boolean = false):TextField 
		{
			var tf:TextField = super.createLabel($textFormat, $embeddedFont);
			
			//tf.border = true;
			tf.multiline = false;
			tf.wordWrap = false;
			tf.maxChars = ConfigBehaviour.MAX_INPUT_FIELD_CHARS;
			tf.restrict = "0-9\n";
			tf.text = "";

			return tf;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////////////////
		override protected function generateBackgroundWidth():Number
		{
			//trace( "Visible Width : " + visibleWidth );
			return visibleWidth;
		}
		
		/////////////////////////////////////////////////////////////////////////////////////////////
		// We want to pad this out with white space to match X characters long...
		/////////////////////////////////////////////////////////////////////////////////////////////
		override public function formatText( $number:Number ):String 
		{
			$number = int( $number );
			if ($number < 0) $number = 0;
			return (isEdittable) ? $number.toString() : PriceLabel.addCommas( $number );
		};
		
		public static function addCommas(number:Number):String 
		{
			var negNum:String = "";
			if (number < 0)
			{
				negNum = "-";
				number = Math.abs(number);
			}
			
			var num:String = String(number);
			var results:Array = num.split(/\./);
			num = results[0];
			
			if (num.length > 3) 
			{
				var mod:Number = num.length%3;
				var output:String = num.substr(0, mod);
				for (var i:Number = mod; i < num.length; i += 3) 
				{
					output += ((mod == 0 && i == 0) ? "" : ",")+num.substr(i, 3);
				}
				
				if (results.length > 1)
				{
					if (results[1].length == 1)
					{
						return negNum+output+"."+results[1]+"0";

					}else{
						return negNum+output+"."+results[1];
					}
				}else{
					return negNum+output;
				}
			}

			if (results.length > 1)
			{
				if (results[1].length == 1)
				{
					return negNum+num+"."+results[1]+"0";

				}else{
					return negNum+num+"."+results[1];
				}
				
			}else{
				return negNum+num;
			}
		}
		/////////////////////////////////////////////////////////////////////////////////////////////
		// Count how may digits there are in a number... all the way to a cool million ;)
		/////////////////////////////////////////////////////////////////////////////////////////////
		private function countDigits( $number:Number ):int
		{
			if ( $number < 10 ) return 1;
			if ( $number < 100 ) return 2;
			if ( $number < 1000 ) return 3;
			if ( $number < 10000 ) return 4;
			if ( $number < 100000 ) return 5;
			if ( $number < 1000000 ) return 6;
			return 7;
		}
	}

}