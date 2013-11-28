package audiobus.models.events 
{
	import flash.events.Event;
	
	/**
	 * ...
	 * @author zen
	 */
	public class LoadingEvents extends Event 
	{
		
		static public const BEGIN:String 	= "onLoadBegins";
		static public const PROGRESS:String = "onLoadProgressed";
		static public const COMPLETE:String = "onLoadCompleted";
		static public const FAILED:String 	= "onLoadFailed";
		
		public var bytesLoaded:Number = 0;
		public var bytesTotal:Number = 0;
		
		public function get percentage():Number
		{
			if (bytesTotal == 0) return 0
			else return bytesLoaded / bytesTotal;
		}
		
		public function LoadingEvents( $type:String, $bubbles:Boolean=false, $cancelable:Boolean=false, $bytesLoaded:Number=0, $bytesTotal:Number=0 ) 
		{ 
			bytesLoaded = $bytesLoaded;
			bytesTotal = $bytesTotal;
			super($type, $bubbles, $cancelable);
		} 
		
		public override function clone():Event 
		{ 
			return new LoadingEvents(type, bubbles, cancelable);
		} 
		
		public override function toString():String 
		{ 
			return formatToString("LoadEvent", "currentTarget", "bytesLoaded", "bytesTotal", "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}