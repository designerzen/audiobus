package audiobus.models.events 
{
	import flash.events.Event;
	
	public class MediaControlEvent extends Event 
	{
		
		static public const STOPPING:String = "onMediaStopping";
		static public const STARTING:String = "onMediaStarting";
		static public const PAUSING:String 	= "onMediaPausing";
		static public const RESUMING:String = "onMediaUnPausing";
		static public const LAST:String 	= "onPreviousMedia";
		static public const NEXT:String 	= "onSubsequentMedia";
		
		public function MediaControlEvent(type:String, bubbles:Boolean=false, cancelable:Boolean=false) 
		{ 
			super(type, bubbles, cancelable);
		} 
		
		public override function clone():Event 
		{ 
			return new MediaControlEvent(type, bubbles, cancelable);
		} 
		
		public override function toString():String 
		{ 
			return formatToString("MediaControlEvent", "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}