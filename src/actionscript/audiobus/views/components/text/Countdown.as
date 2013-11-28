package audiobus.views.components.text 
{
	import flash.events.Event;
	import flash.text.StyleSheet;
	import flash.utils.clearInterval;
	import flash.utils.setTimeout;

	public class Countdown extends CentredTextLabel
	{
		
		private var timer:int;
		private var duration:Number;
		private var counter:Number;
		private var suffix:String = " Seconds";
		
		public function Countdown( $duration:Number=10, $fontSize:uint = 24, $textColour:int = 0x000000, $horizontalPadding:Number = 16, $verticalPadding:Number = 6, $embedFont:Boolean = false, $fontName:String = "_sans" )
		{
			duration = $duration;
			counter = duration;
			
			super( counter + suffix, $fontSize, $textColour, $horizontalPadding, $verticalPadding, $embedFont, $fontName );
		}
		
		public function start():void
		{
			timer = setTimeout( onTimer, 1000 );
		}
		public function stop():void
		{
			clearInterval( timer );
		}
		
		private function onTimer():void
		{
			//
			counter--;
			
			super.text = counter + suffix;
			
			if ( counter == 0 ) onComplete();
			else timer = setTimeout( onTimer, 1000 );
		}
		
		private function onComplete():void
		{
			dispatchEvent( new Event( Event.COMPLETE ) );
		}
		
	}

}