package audiobus.models.events 
{
	import flash.events.Event;
	
	public class FailEvent extends Event 
	{
		public static const FAIL:String = "onFailure";
		
		public function get error():Error
		{
			return _error;
		}
		public function get name():String
		{
			return _error.name;
		}
		public function get id():int
		{
			return _error.errorID;
		}
		public function get message():String
		{
			return _error.message;
		}
		public function get recoverable():Boolean
		{
			return _recoverable;
		}
		
		private var _recoverable:Boolean;
		private var _error:Error;
		
		public function FailEvent( $error:Error, bubbles:Boolean=false, cancelable:Boolean=false, $recoverable:Boolean=false ) 
		{ 
			_error = $error;
			_recoverable = $recoverable;
			super( FAIL, bubbles, cancelable);
		} 
		
		public override function clone():Event 
		{ 
			return new FailEvent( _error, bubbles, cancelable, _recoverable );
		} 
		
		public override function toString():String 
		{ 
			return formatToString("FailEvent", "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}