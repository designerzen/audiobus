package audiobus.models.style 
{
	import flash.text.StyleSheet;
	import flash.text.TextFormat;

	public class CSS extends StyleSheet 
	{
		
		public function CSS() 
		{
			super();
		}
		/*
	    strips the unit from the end of the string and returns the number only
	    supported units are "pt" and "px" (or anything that starts with a "p" really...)
	    textformat doesn't need the units as they're fixed (i.e. size is always pt, indent always px etc.)
	    */
	    private function stripUnit(input:String):Number
	    {
	        return Number( input.substr(0, input.indexOf("p")) );
	    }
	   
	    /*
	    Flash ignores a negative leading and sets it to zero:
	    textFormat.leading = -10;
	    trace(textFormat.leading); // prints "0"
	   
	    However it works when setting it through the constructor (don't ask!):
	    textFormat = new TextFormat(null, null, null, null, null, null, null, null, null, null, null, null, -10);
	    trace(textFormat.leading); // prints "-10"!
	   
	    This function works around this bug by creating a new TextFormat object with the leading in
	    the constructor and re-setting all the previously set properties, except leading...
	    It's dirty but it works...
	    */
	    private function negativeLeadingFix( textFormat:TextFormat, leading:Number ):TextFormat
	    {
	        if (leading>=0)
	        {
	            textFormat.leading = leading;
	            return textFormat;
	        } else {
	            var newTextFormat:TextFormat = new TextFormat(null, null, null, null, null, null, null, null, null, null, null, null, leading);
	            for (var property:String in textFormat)if (property!="leading") newTextFormat[property]=textFormat[property];
	            return newTextFormat;
	        }
	    }
	   
    	// override the transform method
		override public function transform( formatObject:Object) : TextFormat
		{
			/*
			var format:TextFormat = super.transform(style);
	        for (var property:String in style)
	        {
	            switch (property)
	            {
	                case "leading": formatObject = negativeLeadingFix( formatObject, stripUnit(style[property]) ); break;
	                case "blockIndent": formatObject.blockIndent = stripUnit(style[property]); break;
	                case "tabStops": formatObject.tabStops = String(style[property]).split(","); break;
	                case "bullet": formatObject.bullet = (style[property]=="true"); break;
	            }
	        }
	        return formatObject;*/
			return super.transform( formatObject );
		}
	    
	}
}