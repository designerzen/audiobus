package audiobus.models.events 
{
	import flash.events.Event;
	
	public class BufferingEvent extends Event 
	{
		public static const BUFFERING_BEGUN:String 	= "onBufferingBegin";
		public static const BUFFERING_END:String 	= "onBufferingEnd";
		
		// , bufferingBytes:Number=0, bufferingBytesTotal:Number=0
		public function BufferingEvent( type:String, bubbles:Boolean=false, cancelable:Boolean=false ) 
		{ 
			super(type, bubbles, cancelable);
		} 
		
		public override function clone():Event 
		{ 
			return new BufferingEvent(type, bubbles, cancelable);
		} 
		
		public override function toString():String 
		{ 
			return formatToString("BufferingEvent", "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}