package audiobus 
{
	import audiobus.controllers.media.Playlist;
	import audiobus.services.media.IMediaControl;
	
	public class Conductor 
	{
		static public const PLAYLIST:Playlist = new Playlist( false, false, false );
		static public var sound:IMediaControl;
		
		// flash vars
		static private var nameSpace:String;
		static private var volume:Number;

		// js vars
		static private var eqData:String;
		static private var crossDomain:String = '*';
		
		static public function create( $nameSpace:String ):void
		{
			nameSpace = $nameSpace;
			
			PLAYLIST.volume = volume;
			PLAYLIST.addEventListener( VolumeEvent.CHANGE, onVolumeChanged );
			PLAYLIST.addEventListener( PositionChangeEvents.BEGIN, onPositionChanged );
			PLAYLIST.addEventListener( PositionChangeEvents.CHANGE, onPositionChanged );
			PLAYLIST.addEventListener( PositionChangeEvents.COMPLETE, onPositionChanged );
			PLAYLIST.addEventListener( BufferingEvent.BUFFERING_BEGUN, onBuffering );
			PLAYLIST.addEventListener( BufferingEvent.BUFFERING_END, onBuffering );
			PLAYLIST.addEventListener( LoadingEvents.BEGIN, onLoading );
			PLAYLIST.addEventListener( LoadingEvents.PROGRESS, onLoading );
			PLAYLIST.addEventListener( LoadingEvents.COMPLETE, onLoading );
			PLAYLIST.addEventListener( LoadingEvents.FAILED, onLoading );
			PLAYLIST.addEventListener( FailEvent.FAIL, onFailure );
		}
	}

}