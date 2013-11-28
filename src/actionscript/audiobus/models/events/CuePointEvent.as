package audiobus.models.events 
{
	import flash.events.Event;
	
	public class CuePointEvent extends Event 
	{
		public static const CUE_POINT:String = "onCuePoint";
		
		public function get name():String
		{
			return _name;
		}
		public function get time():Number
		{
			return _time;
		}
		
		private var _time:Number;
		private var _name:String;
		
		public function CuePointEvent( $time:Number, $name:String='' , bubbles:Boolean=false, cancelable:Boolean=false ) 
		{ 
			_time = $time;
			_name = $name;
			super(CUE_POINT, bubbles, cancelable);
		} 
		
		public override function clone():Event 
		{ 
			return new CuePointEvent( _time, _name, bubbles, cancelable );
		} 
		
		public override function toString():String 
		{ 
			return formatToString("CuePointEvent", _time, _name, "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}