package audiobus.controllers.media 
{
	import flash.events.EventDispatcher;
	import flash.events.IEventDispatcher;
	import flash.media.SoundTransform;
	import flash.media.SoundMixer;
	import audiobus.models.events.VolumeEvent;
	
	public class Mixer extends EventDispatcher 
	{
		private static var masterFader:Number;
		
		public static function get volume():Number
		{
			return SoundMixer.soundTransform.volume;
		}	
		
		public static function set volume( $volume:Number ):void
		{
			masterFader = SoundMixer.soundTransform.volume = $volume;
		}
		
		public static function get pan():Number
		{
			return SoundMixer.soundTransform.pan;
		}	
		
		public static function set pan( $pan:Number ):void
		{
			masterFader = SoundMixer.soundTransform.pan = $pan;
		}
		
		public function Mixer(target:IEventDispatcher=null) 
		{
			super(target);
		}
		
		public static function mute():void
		{
			masterFader = SoundMixer.soundTransform.volume;
			SoundMixer.soundTransform.volume = 0;
		}	
		
		public static function unmute():void
		{
			SoundMixer.soundTransform.volume = masterFader;
		}
		
	}

}