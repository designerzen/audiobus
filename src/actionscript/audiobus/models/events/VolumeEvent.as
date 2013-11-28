package audiobus.models.events 
{
	import flash.events.Event;

	public class VolumeEvent extends Event 
	{
		public static const CHANGE:String = "onVolumeChange";
		public static const MUTE:String = "onVolumeMuted";
		public static const UNMUTE:String = "onVolumeUnMuted";
		
		public function get volume():Number 
		{
			return _volume;
		}
		
		private var _volume:Number;
		
		public function VolumeEvent( $type:String, $volume:Number, $bubbles:Boolean=false, $cancelable:Boolean=false) 
		{ 
			_volume = $volume;
			super( $type, $bubbles, $cancelable );
		} 
		
		public override function clone():Event 
		{ 
			return new VolumeEvent( type, _volume, bubbles, cancelable );
		} 
		
		public override function toString():String 
		{ 
			return formatToString("VolumeEvent", _volume, "type", "bubbles", "cancelable", "eventPhase"); 
		}
		
	}
	
}