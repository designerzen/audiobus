package audiobus.controllers.media 
{
	import audiobus.models.events.BufferingEvent;
	import audiobus.models.events.FailEvent;
	import audiobus.models.events.LoadingEvents;
	import audiobus.models.events.MediaControlEvent;
	import audiobus.models.events.PositionChangeEvents;
	import audiobus.models.events.VolumeEvent;
	import audiobus.models.media.MediaModel;
	import audiobus.services.media.IMedia;
	import audiobus.services.media.IMediaControl;
	import flash.events.EventDispatcher;
	
	public class Playlist extends EventDispatcher implements IPlaylist, IMediaControl, IMedia
	{
		private var dispatchMediaEvents:Boolean = true;
		
		public static var playlistID:int = 0;
	
		// Place to keep all items
		protected var mediaControlItems:Vector.<IMediaControl>;
		protected var index:uint = 0;
		protected var model:MediaModel;
		protected var stopOnErrors:Boolean;
		
		public function Playlist( $loadImmediately:Boolean = false, $playImmediately:Boolean = false, $stopOnError:Boolean=false )  
		{
			stopOnErrors = $stopOnError;
			mediaControlItems = new Vector.<IMediaControl>();
			model = new MediaModel( $loadImmediately, $playImmediately );
		}
		
		// Getters ===================================================
		public function get currentItem():IMediaControl
		{
			return mediaControlItems[ index ];
		}
		
		public function get items():Vector.<IMediaControl>
		{
			return mediaControlItems;
		}
		
		public function get isPaused():Boolean 
		{
			return model.isPaused;
		}
			
		public function get isFirst():Boolean 
		{
			return index == 0;
		}
		
		public function get isLast():Boolean 
		{
			return index == mediaControlItems.length - 1;
		}
		
		public function get loadProgress():Number 
		{
			return model.loadProgress;
		}
		
		public function get position():Number 
		{
			return model.position;
		}
		
		public function get bufferTime():Number 
		{
			return currentItem.bufferTime;
		}
		
		public function get isBuffering():Boolean 
		{
			return model.isBuffering;
		}
		
		public function get bufferLength():Number 
		{
			return currentItem.bufferLength;
		}
		
		public function get volume():Number 
		{
			return model.volume;
		}
		
		public function get panning():Number 
		{
			return model.panning;
		}
		
		public function get id():int 
		{
			return model.id;
		}
		
		public function get duration():Number 
		{
			return currentItem.duration;
		}
		
		public function get quantity():int 
		{
			return mediaControlItems.length;
		}
		// Setters ===============================================
		
		public function set volume( $vol:Number):void 
		{
			model.volume = $vol;
			if ( mediaControlItems.length > 0 ) currentItem.volume = model.volume;
			onVolumeChanged( new VolumeEvent( VolumeEvent.CHANGE, model.volume, false, false ) );
		}
		
		public function set panning( $pan:Number):void 
		{
			currentItem.panning = model.panning = $pan;
		}
		
		public function set bufferTime( $bufferTime:Number):void 
		{
			currentItem.bufferTime = model.bufferTime = $bufferTime;
		}
		
		public function set stopOnError( $value:Boolean):void
		{
			stopOnErrors = $value;
		}
		
		public function set autoPlay( $value:Boolean):void 
		{
			model.autoPlay = $value;
		}
		
		public function set position($value:Number):void 
		{
			model.position = $value;
		}
		
		// Action / Control Methods =======================================================
	
		// Add at the end of the playlist an item
		public function append( $item:IMediaControl ):int 
		{
			model.duration += $item.duration;
			return mediaControlItems.push( $item );
		}
		
		// Add straight after the current active item and return new index
		public function add( $item:IMediaControl ):int 
		{
			return insert($item, index+1);
		}
		
		// Add item at a specific point and return new index of file
		public function insert( $item:IMediaControl, $position:int ):int 
		{
			model.duration += $item.duration;
			mediaControlItems.splice( $position, 0, $item );
			return $position;
		}
		
		// Combine two playlists into one
		public function merge( $playlist:IPlaylist ):void
		{
			model.duration += $playlist.duration;
			mediaControlItems.concat( $playlist );
		}
		
		// Rearrange all of these items in a random fashion
		public function shuffle():void 
		{
			
		}
		
		// ?
		public function unload():void 
		{
			
		}
		
		public function goTo( $position:int ):IMediaControl 
		{
			$position;
			if ( $position < 0 ) $position = 0;
			else if ( $position > mediaControlItems.length ) $position = mediaControlItems.length;
			return mediaControlItems[ $position ];
		};
		
	
		
		public function play():IMediaControl 
		{
			
		}
		
		/////////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////////
		public function cue( $bufferTime:Number = 3000 ):void 
		{
			currentItem.cue( $bufferTime );
		}
			
		
		/////////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////////
		public function previous():IMediaControl 
		{
			stop();
			
			if ( index <= 0 )
			{
				if ( model.loops < 0 ) 
				{
					// loop around to the last one
					index = mediaControlItems.length - 1;
					start();
				}else {
					//stop();
					trace('Playlist::Previous - Beginning Reached, loop not set. Stopping.');
					return null;
				}
			}else {
				index -= 1;
				start();
			}
			
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.LAST ) );
			
			/*
			index -= 1;
			trace("Playlist::PREVIOUS : "+index );
			start();*/
			return currentItem;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Goto the NEXT item in this playlist or if loop is set, restart the playlist!
		/////////////////////////////////////////////////////////////////////////////////////
		public function next():IMediaControl 
		{
			stop();
			if ( index == mediaControlItems.length-1 )
			{
				if ( model.loops < 0 ) 
				{
					// loop round back to zero
					index = 0;
					start( );
				}else {
					// do not continue
					//if ( ( index == items.length-1 ) && ( model.loops >= 0 ) ) onPlaylistComplete();
					onPlaylistComplete();
					return null;
				}
			}else {
				// progress to next index
				index += 1;
				start();
			}
			
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.NEXT ) );
			return currentItem;
		};
		
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Begin Playlist from beginning again
		/////////////////////////////////////////////////////////////////////////////////////
		public function restart():void 
		{
			stop();
			index = 0;
			start();
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Start the playlist from the beginning of the current active item
		/////////////////////////////////////////////////////////////////////////////////////
		public function start( $startTime:Number = 0 ):void 
		{
			if (!model.isPaused) throw Error("starting an already started playlist");
			if ( currentItem.isPaused ) startMonitoringItem( currentItem );
			currentItem.volume = model.volume;
			currentItem.start();
			model.isPaused = false;
			//trace( index + '. start:' + currentItem);
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.STARTING ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Stop the current item and the playlist immediately
		/////////////////////////////////////////////////////////////////////////////////////
		public function stop():void 
		{
			currentItem.stop();
			stopMonitoringItem( currentItem );
			model.isPaused = true;
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.STOPPING ) );
		};
		
		public function pause():void 
		{
			// first check to see if the item has been paused through some other device
			if (model.isPaused) return;
			
			trace( "Playlist Pause requested is item paused? "+ currentItem.isPaused );
			
			currentItem.pause();
			model.isPaused = true;
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.PAUSING ) );
		}
		
		public function resume():void 
		{
			// first check to see if the item has been paused through some other device
			if (!model.isPaused) return;
			trace( "Playlist Resume requested is item paused? "+ currentItem.isPaused );
			currentItem.resume();
			model.isPaused = false;
			if (dispatchMediaEvents) dispatchEvent( new MediaControlEvent( MediaControlEvent.RESUMING ) );
		}
		
		public function togglePause():void 
		{
			currentItem.togglePause();
			model.isPaused = currentItem.isPaused;
			if (dispatchMediaEvents) 
			{
				if (model.isPaused) dispatchEvent( new MediaControlEvent( MediaControlEvent.PAUSING ) );
				else dispatchEvent( new MediaControlEvent( MediaControlEvent.RESUMING ) );
			}
		}

		public function seek($position:Number):void 
		{
			currentItem.seek( $position );
		}

		// Utils ===========================================
		private function createUniqueID():int
		{
			return playlistID++;
		}
		
		public function startMonitoringItem( $item:IMediaControl ):void
		{
			$item.addEventListener( VolumeEvent.CHANGE, onVolumeChanged );
			$item.addEventListener( PositionChangeEvents.BEGIN, onPositionChanged );
			$item.addEventListener( PositionChangeEvents.CHANGE, onPositionChanged );
			$item.addEventListener( PositionChangeEvents.COMPLETE, onPositionChanged );
			$item.addEventListener( BufferingEvent.BUFFERING_BEGUN, onBuffering );
			$item.addEventListener( BufferingEvent.BUFFERING_END, onBuffering );
			$item.addEventListener( LoadingEvents.BEGIN, onLoading );
			$item.addEventListener( LoadingEvents.PROGRESS, onLoading );
			$item.addEventListener( LoadingEvents.COMPLETE, onLoading );
			$item.addEventListener( LoadingEvents.FAILED, onLoading );
			$item.addEventListener( FailEvent.FAIL, onFailure );
		};
			
		public function stopMonitoringItem( $item:IMediaControl ):void
		{
			$item.removeEventListener( VolumeEvent.CHANGE, onVolumeChanged );
			$item.removeEventListener( PositionChangeEvents.BEGIN, onPositionChanged );
			$item.removeEventListener( PositionChangeEvents.CHANGE, onPositionChanged );
			$item.removeEventListener( PositionChangeEvents.COMPLETE, onPositionChanged );
			$item.removeEventListener( BufferingEvent.BUFFERING_BEGUN, onBuffering );
			$item.removeEventListener( BufferingEvent.BUFFERING_END, onBuffering );
			$item.removeEventListener( LoadingEvents.BEGIN, onLoading );
			$item.removeEventListener( LoadingEvents.PROGRESS, onLoading );
			$item.removeEventListener( LoadingEvents.COMPLETE, onLoading );
			$item.removeEventListener( LoadingEvents.FAILED, onLoading );
			$item.removeEventListener( FailEvent.FAIL, onFailure );
		};
		
		protected function onLoading( $event:LoadingEvents ):void 
		{
			switch( $event.type )
			{
				case LoadingEvents.BEGIN:
					//trace("\n=================================");
					
					break;
				case LoadingEvents.PROGRESS:
					break;
				case LoadingEvents.COMPLETE:
					break;
				case LoadingEvents.FAILED:
					
					break;
			}
			dispatchEvent ( $event );
			//trace( "Playlist : " +  $event.type + " [" + int($event.percentage * 100) + "%]");
		};
		
		protected function onBuffering( $event:BufferingEvent ):void 
		{
			switch( $event.type )
			{
				case BufferingEvent.BUFFERING_BEGUN:
					trace( index + "Playlist : Buffering Begins <-----------------------" );
					model.isBuffering = true;
					break;
				case BufferingEvent.BUFFERING_END:
					trace( index+ "Playlist : Buffering Ends ---------------------->" );
					model.isBuffering = false;
					break;
			}
			dispatchEvent( $event );
		};
		
		// Position of item has altered : Begin / Updated / Completed
		protected function onPositionChanged( $event:PositionChangeEvents ):void 
		{
			//trace( "Playlist : Position Changed to " + $event.position + " ("+$event.progress+") via " + $event.type );
			switch( $event.type )
			{
				case PositionChangeEvents.BEGIN:
					break;
					
				case PositionChangeEvents.CHANGE:
					break;
					
				case PositionChangeEvents.COMPLETE:
					next();
					
					break;
			}
			dispatchEvent( $event );
		};
		
		
		protected function onPlaylistComplete():void 
		{
			trace( "Playlist completed! Loop not set" );
			//TODO: implement some position change events for the playlist!
			//dispatchEvent( new MediaControlEvent( MediaControlEvent.
		}
		
		private function onVolumeChanged( $event:VolumeEvent ):void 
		{
			trace( "Playlist : Volume Changed to " + $event.volume );
			dispatchEvent( $event );
		};
		
		private function onFailure( $event:FailEvent ):void 
		{
			var error:Error = $event.error;
			trace( "Playlist #FAIL# : " + error );
			dispatchEvent( $event );
			// skip this entry as it is bad
			// Pause here perhaps?
			if ( !stopOnErrors ) next();
			else pause();
		};
		
		override public function toString():String
		{
			var output:String = "";
			var count:int = 1;
			output += "\n----------------------------------------------------------------------------------------------------------------------\n";
			for each ( var item:IMediaControl in mediaControlItems ) output += (count++) + ". " + item + "\n";
			output += "----------------------------------------------------------------------------------------------------------------------\n";
			return output;
		}
		
	}

}