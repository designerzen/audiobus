package audiobus.services.media 
{
	import flash.events.IEventDispatcher;
	
	public interface IMediaControl extends IEventDispatcher
	{
		// Getters
		function get isBuffering():Boolean;
		function get isPaused():Boolean;
		function get loadProgress():Number;
		function get bufferTime():Number;
		function get bufferLength():Number;
		function get position():Number;
		function get duration():Number;
		function get volume():Number;		
		function get panning():Number;
		function get id():int;
		
		// Setters
		function set volume( $volume:Number ):void;			// Set *all* items in this playlist (and future items also) to this volume
		function set panning( $panning:Number ):void; 		// Set *all* items in this playlist (and future items also) to this panning
		function set bufferTime( $bufferTime:Number ):void;	// Set the position of the current active track to this position
		function set autoPlay( $autoPlay:Boolean ):void;	// Do we want this item to automatically start?
		function set position( $position:Number ):void;		// Set the position of the track to X seconds
		
		// Load in an item
		// (sID:String, sURL:String, bStream: Boolean, bAutoPlay: Boolean, nLoops: Number, bAutoLoad: Boolean, bCheckPolicyFile: Boolean)
		function cue( $bufferTime:Number=3000 ):void;
		function unload():void;
	
		// Start the playlist
		function start( $startTime:Number = 0 ):void;
		
		// Stop this playlist
		function stop():void;
		
		// Pause this playlist
		function pause():void;
		
		// Resume this playlist (if paused)
		function resume():void;		
		
		// Jump to the specified position, or set the file to play back from position if paused
		function seek( $position:Number ):void;
		
		// Pause this playlist or Unpause playlist if already paused
		function togglePause():void;
		
		// 
		//function disconnect():void;
		
	}
	
}