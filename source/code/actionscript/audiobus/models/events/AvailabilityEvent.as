package audiobus.models.events 
{
	import flash.events.Event;
	
	
	
	public class AvailabilityEvent extends Event 
	{
		
		public static const AVAILABLE:String = "onDataAvailable";
		public static const NOT_AVAILABLE:String = "onDataNotAvailable";
		
		public function AvailabilityEvent( $type:String=AVAILABLE, $bubbles:Boolean=false, $cancelable:Boolean=false ) 
		{ 
			super( $type, $bubbles, $cancelable );
		} 
		
		public override function clone():Event 
		{ 
			return new AvailabilityEvent(type, bubbles, cancelable);
		} 
		
		public override function toString():String 
		{ 
			return formatToString("AvailabilityEvent", "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}