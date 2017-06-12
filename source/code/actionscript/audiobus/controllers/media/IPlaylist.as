package audiobus.controllers.media 
{
	import audiobus.services.media.IMediaControl;
	import flash.events.IEventDispatcher;
	
	public interface IPlaylist extends IEventDispatcher, IMediaControl
	{
		function get items():Vector.<IMediaControl>;
		function get isFirst():Boolean;
		function get isLast():Boolean;
		function get quantity():int;
		function get currentItem():IMediaControl;
		
		// Jump back to the very first item in the list
		function restart():void;
		
		// Jump to the last track
		function previous():IMediaControl;
		
		// Jump to the next track
		function next():IMediaControl;
		
		// Play a url by appending if not already in the playlist
		function play():IMediaControl;
		
		// Add a track to the end of the playlist, returns ID
		function append( $item:IMediaControl ):int;
		
		// Add a track straight after the current playing track.
		function add( $item:IMediaControl ):int;
		
		// Insert a track at a certain point in the playlist 
		function insert( $item:IMediaControl, $position:int ):int;
		
		// Combine two playlists into one
		function merge( $playlist:IPlaylist ):void
		
		// Re-organise the position of all of the items
		function shuffle():void;
	}
	
}