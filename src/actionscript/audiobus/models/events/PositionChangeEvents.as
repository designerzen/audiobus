package audiobus.models.events 
{
	import flash.events.Event;
	
	public class PositionChangeEvents extends Event 
	{
		public static const BEGIN:String = "onBegin";
		public static const CHANGE:String = "onPositionChange";
		public static const COMPLETE:String = "onComplete";
		
		private var _position:Number;
		private var _duration:Number;
		
		public function get position():Number 
		{
			return _position;
		}
			
		public function get progress():Number 
		{
			return ( _duration > 0 ) ? _position / _duration : 0;
		}
		
		public function PositionChangeEvents( $position:Number, $duration:Number=0, $type:String=CHANGE , $bubbles:Boolean=false, $cancelable:Boolean=false) 
		{ 
			_position = $position;
			_duration = $duration;
			super( $type, $bubbles, $cancelable );
		} 
		
		public override function clone():Event 
		{ 
			return new PositionChangeEvents( _position, _duration, type, bubbles, cancelable);
		} 
		
		public override function toString():String 
		{ 
			return formatToString("PositionChangeEvent", _position, _duration, "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	
	}
	
}