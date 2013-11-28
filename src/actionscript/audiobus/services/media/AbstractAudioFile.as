/*/////////////////////////////////////////////////////////////////////////

A very basic abstract class that handles the inner wirings of an audio
file. This does NOT allow for streaming via RTMP, simply file based URLs

Extend this file for each datatype that you wish to create.

Supported File Types : MP3

/////////////////////////////////////////////////////////////////////////*/
package audiobus.services.media 
{
	import audiobus.models.events.BufferingEvent;
	import audiobus.models.events.FailEvent;
	import audiobus.models.events.LoadingEvents;
	import audiobus.models.events.PositionChangeEvents;
	import audiobus.models.events.VolumeEvent;
	import audiobus.models.media.AudioModel;
	import flash.events.Event;
	import flash.events.EventDispatcher;
	import flash.events.IOErrorEvent;
	import flash.events.ProgressEvent;
	import flash.media.ID3Info;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.media.SoundLoaderContext;
	import flash.media.SoundTransform;
	import flash.net.URLRequest;
	import flash.utils.clearInterval;
	import flash.utils.setTimeout;

	public class AbstractAudioFile extends AbstractMedia implements IMediaControl, IMedia
	{
		private var sound:Sound;							// This is where we fecth the audio data from
		private var soundChannel:SoundChannel;				// This is where we pump the audio data to
		private var soundLoaderContext:SoundLoaderContext;	// Used to allow for buffering and cross domain
		private var soundTransform:SoundTransform;			// Change Volume and PSanning
		private var soundRequested:Boolean = false;			// if it is available in memory, even if just in part.
		
		private var request:URLRequest;						// This is where we suck the data from
		private var timer:uint;								// set interval id
		
		// TODO : Remove this variable
		private var hasBegun:Boolean = false;
		
		public var model:AudioModel;						// This contains all of the specific bits of the data
		
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Getters & Setters :
		/////////////////////////////////////////////////////////////////////////////////////
		
		// Position in milliseconds of file
		public function set position( $position:Number ):void
		{
			seek( $position );
		};
		public function get position():Number 
		{
			if (soundChannel) model.position = soundChannel.position;
			return model.position;
		};
		
		public function get duration():Number 
		{
			if (sound) model.duration = sound.length;
			return model.duration;
		}
		
			
		// Volume :
		// Get the volume of *this* sound only
		public function set volume( $volume:Number ):void
		{
			model.volume = $volume;
			if (soundTransform && soundChannel)
			{
				// only change it if it is different to the cached volume
				if ( soundTransform.volume != model.volume )
				{
					soundTransform.volume = model.volume;
					//trace ( soundTransform.volume );
					soundChannel.soundTransform = soundTransform;
					dispatchEvent( new VolumeEvent( VolumeEvent.CHANGE, model.volume ) );
				}
			}
		};
		public function get volume():Number 
		{
			if (soundTransform) model.volume = soundTransform.volume;
			return model.volume;
		};
		
		// Stereo Panning :
		// -1 = Hard Left, 0 = central, +1 = Hard Right
		public function set panning( $panning:Number ):void
		{
			model.panning = $panning;
			if (soundTransform) soundTransform.pan = $panning;
		};
		public function get panning():Number 
		{
			return model.panning;
		};
		
		// Peak Amplitude at this particular moment
		public function get leftPeak():Number
		{
			if (soundChannel) model.leftPeak = soundChannel.leftPeak;
			return model.leftPeak;
		};
		public function get rightPeak():Number
		{
			if (soundChannel) model.rightPeak = soundChannel.rightPeak;
			return model.rightPeak;
		};
		
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Buffer Time in seconds
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function set bufferTime( $bufferTime:Number):void
		{
			model.bufferTime = $bufferTime;
			if ( soundLoaderContext ) soundLoaderContext.bufferTime = $bufferTime;	// set direct if possible
		};
		public function get bufferTime():Number
		{
			return ( soundLoaderContext ) ? soundLoaderContext.bufferTime : model.bufferTime;
		};
		public function get bufferLength():Number 
		{
			return this.bufferTime;
		}
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Is this audio file in memory, just paused?
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function get isPaused():Boolean
		{
			return model.isPaused;
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Is this audio file currently inaudible whilst the remaining buffer is filling up?
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function get isBuffering():Boolean
		{
			return (sound) ? sound.isBuffering : false;
		};
		
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Will this file automatically play when created / instantiated
		// or will it have to wait for its 'start()' method to be called?
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function get autoPlay():Boolean
		{
			return model.autoPlay;
		};
		public function set autoPlay($autoPlay:Boolean):void 
		{
			// TODO : Check to see if this has changed and if so DO something!
			model.autoPlay = $autoPlay;
		};
		
		public function get loadProgress():Number
		{
			return model.loadProgress;
		}

		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Fetch unique identifier
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function get id():int 
		{
			return model.id;
		}
		
		// ================================================================================--------------
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Construct
		// $bufferTime:Number=1000, $checkPolicyFile:Boolean=false
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function AbstractAudioFile( $audioModel:AudioModel ) 
		{
			// Save audio model if set
			model = $audioModel;
			// Set unique ID to identify this data later
			model.id = super.createUniqueID();
			// Load in our request with specified context
			if ( model.autoLoad ) 
			{
				cue();
			}
			if ( model.autoPlay )
			{
				start();
			}
		};
	
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Create a Sound object in memory and wire it up!
		//////////////////////////////////////////////////////////////////////////////////////////////////
		override protected function create( $bufferTime:Number=0 ):void
		{
			super.create();
			// create a http request handshake with this url
			request = new URLRequest( model.url );
			// create our context for loading this data through
			soundLoaderContext = new SoundLoaderContext( $bufferTime , model.crossDomain );
			
			// If we haven't already, lets create a sound transform instance to handle individual volumes & panning
			soundTransform = new SoundTransform( model.volume, model.panning );
			
			// now load in our data into memory!!
			//sound = new Sound( null, soundLoaderContext );
			sound = new Sound();
			
			// add event listeners to handle logic
			sound.addEventListener( Event.OPEN, onLoadBegin );
			sound.addEventListener( ProgressEvent.PROGRESS, onLoadProgress );
			sound.addEventListener( Event.COMPLETE, onLoadingComplete );
			sound.addEventListener( Event.ID3, onID3MetaData );
			sound.addEventListener( IOErrorEvent.IO_ERROR, onIOError );
			
			sound.load( request );
			
			// as we have loaded some into memory, upade request flag
			soundRequested = true;
		};
		
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Free up memory by destroying all but the sparcest of data
		//////////////////////////////////////////////////////////////////////////////////////////////////
		override protected function destroy():void
		{
			clearInterval( timer );
			
			super.destroy();
			//sound.close();
			// rmove listeners
			
			sound.removeEventListener( Event.OPEN, onLoadBegin );
			sound.removeEventListener( ProgressEvent.PROGRESS, onLoadProgress );
			sound.removeEventListener( Event.COMPLETE, onLoadingComplete );
			sound.removeEventListener( Event.ID3, onID3MetaData );
			sound.removeEventListener( IOErrorEvent.IO_ERROR, onIOError );
			soundChannel.removeEventListener( Event.SOUND_COMPLETE, onComplete );
			// clear objects in memory
			sound = null;
			soundLoaderContext = null;
			soundTransform = null;
			soundChannel = null;
			// reset parameters
			soundRequested = false;
			model.bytesLoaded = 0;
			model.position = 0;
		};
		
		/**/
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Loads in a file without actually playing it
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function cue( $bufferTime:Number=3000 ):void 
		{
			model.isPaused = true;							// update the model
			if ( !soundRequested ) create( $bufferTime );	// create the sound objects
			trace( "Cuing to Memory "+model.url );
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Clear as much memory as possible but retain the basic models!
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function unload():void 
		{
			destroy();
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// BEGIN PLAYBACK : Begin loading sound into memory and commence audio playback
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function start( $startTime:Number = -1 ):void 
		{
			var startFrom:Number = ( $startTime == -1 ) ?  model.position : $startTime;
			
			// If this is sat idle in memory, firstly initialise and buffer some bytes
			if (!soundRequested) create( model.bufferTime );
			else this.bufferTime = model.bufferTime;				// Set the buffer time ( as already created with large buffer )
			
			// Cancel any playback that may already be occuring
			if (soundChannel)
			{
				if ( !model.isPaused && model.position == soundChannel.position )
				{
					// already playing
					return void;
				}
				soundChannel.stop();
				soundChannel = null;
			}
			
			// update our volume in case we want to start without volume set at 1
			soundTransform.volume = model.volume;
			
			// update our model
			model.isPaused = false;
			model.isBuffering = false;// sound.isBuffering;	// we will check this immediately with the onTimer method
			model.position = startFrom;
			
			// Now begin the sound and store it's channel data for manipulation later
			soundChannel = sound.play( model.position, model.loops, soundTransform );
			soundChannel.addEventListener( Event.SOUND_COMPLETE, onComplete );
			trace( "Start Requested from position : "+startFrom+" sound already in memory:"+soundRequested + " position really::"+soundChannel.position );
			
			onTimer();
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// STOP PLAYBACK and return to position zero
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function stop( ):void 
		{
			if (!soundRequested) return void;
			// stop the timer
			disconnect();
			// nothing to stop!
			trace( "Stop Requested " + timer);
			// stop all audio
            soundChannel.stop();
			//update model information accordingly
			model.position = 0;		// jump back to position 0
			model.isPaused = true;	// set paused to true
			
			// try and save some bytes by destroying
			destroy();
		};
		
		public function disconnect():void
		{
			clearInterval( timer );
			// check to see if buffering is occuring and dispatch complete event
			if ( model.isBuffering )
			{
				model.isBuffering = false;
				dispatchEvent( new BufferingEvent( BufferingEvent.BUFFERING_END ) );
			}
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Pause stops the audio stream but does not stop the subsequent bytes from being loaded in
		// Useful for preloading a track
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function pause():void 
		{
			trace( model.isPaused + " Pause Requested on "+model );
			// already paused
			if ( model.isPaused ) return void;
			model.isPaused = true;
			clearInterval( timer );
			model.position = soundChannel.position;
			soundChannel.stop();
			// TODO:
			//dispatchEvent( new MediaControlEvent() );
		};
		
		// Resume playback from paused position
		public function resume():void 
		{
			trace( model.isPaused + " Resume Requested from position "+model.position );
			if ( !model.isPaused ) return void;
			start( model.position );
			
		};
		
		public function seek( $position:Number ):void
		{
			model.position = $position;
			if ( !this.isPaused && soundChannel && soundTransform ) 
			{
				soundChannel.stop();
				soundChannel = sound.play( $position, model.loops, soundTransform );
			}
		}
		
		public function togglePause():void
		{
			if ( model.isPaused ) resume();
			else pause();
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Event Handlers :
		/////////////////////////////////////////////////////////////////////////////////////
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Loading begun!
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadBegin( $event:Event):void 
		{
			$event.stopImmediatePropagation();
			dispatchEvent( new LoadingEvents( LoadingEvents.BEGIN , false, false, 0, 0 ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Loading in progress
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadProgress( $event:ProgressEvent ):void 
		{
			$event.stopImmediatePropagation();
			model.bytesLoaded = $event.bytesLoaded;
			model.bytesTotal = $event.bytesTotal;
			dispatchEvent( new LoadingEvents( LoadingEvents.PROGRESS, false, false, model.bytesLoaded, model.bytesTotal ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Completed the loading of this track
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadingComplete( $event:Event ):void 
		{
			$event.stopImmediatePropagation();
			dispatchEvent( new LoadingEvents( LoadingEvents.COMPLETE, false, false, model.bytesLoaded, model.bytesTotal ) );
		};
				
		/////////////////////////////////////////////////////////////////////////////////////
		// Failed to load this track
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadFailed():void 
		{
			dispatchEvent( new LoadingEvents( LoadingEvents.FAILED ) );
			onFailure( new Error( "Loading Failed" ) , false );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Time is going on!
		/////////////////////////////////////////////////////////////////////////////////////
		private function onTimer():void
		{
			var interval:Number = 100;
			var hasProgressed:Boolean = (soundChannel.position != model.position);
		
			// change the amount of times we call this method
			if ( soundChannel.position < 3000 ) interval = 1;
			else if ( soundChannel.position > 5000 ) interval = 50;
			else if ( soundChannel.position > 9000 ) interval = 1000;
			
			//trace( "onTimer : " + interval);
			
			// overwrite the duration var
			if (model.duration < sound.length) model.duration = sound.length;
			
			// if we have begun buffering or are ending it && !hasProgressed && (model.loadProgress<1)
			if ( sound.isBuffering  )
			{
				// Buffering!
				if (!model.isBuffering) onBufferingBegin();
				interval = 1;	// speed up the callback time until we can resume playback
			} else {
				// If this was buffering but no longer is and position is at the start...
				if ( !hasBegun ) if ( soundChannel.position == 0 ) onBegin();
				if (model.isBuffering) onBufferingEnd();
			}
			
			trace( 'sound.isBuffering' + sound.isBuffering + ' / ' + soundChannel.position +' @ '+ sound.length);
				
			// If we have advanced position
			if ( hasProgressed ) onProgress();
			
			// If we have completed!
			//if ( ( soundChannel.position == sound.length )&& hasBegun ) onComplete();
			if ( ( soundChannel.position == model.duration )&& hasBegun ) onComplete();
			else timer = setTimeout( onTimer, interval );
			
			// trace( interval+". Playing : "+!model.isPaused+" Buffering : "+ this.isBuffering+" Position : "+this.position );	
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Begin Loading
		/////////////////////////////////////////////////////////////////////////////////////
		private function onBegin():void 
		{		
			hasBegun = true;
			dispatchEvent( new PositionChangeEvents( model.position, model.duration, PositionChangeEvents.BEGIN ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Playing...
		/////////////////////////////////////////////////////////////////////////////////////
		private function onProgress():void 
		{
			model.position = soundChannel.position;
			dispatchEvent( new PositionChangeEvents( model.position, model.duration ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Buffer Empty, now refill
		/////////////////////////////////////////////////////////////////////////////////////
		private function onBufferingBegin():void
		{
			model.isBuffering = true;
			dispatchEvent( new BufferingEvent( BufferingEvent.BUFFERING_BEGUN ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Buffer Full, resume playback!
		/////////////////////////////////////////////////////////////////////////////////////
		private function onBufferingEnd():void
		{
			model.isBuffering = false;
			dispatchEvent( new BufferingEvent( BufferingEvent.BUFFERING_END ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Completed
		/////////////////////////////////////////////////////////////////////////////////////
		private function onComplete( $event:Event = null ):void
		{
			// TODO :p
			pause();
			dispatchEvent( new PositionChangeEvents( model.position, model.duration, PositionChangeEvents.COMPLETE ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Meta Data Received
		/////////////////////////////////////////////////////////////////////////////////////
		private function onID3MetaData( $event:Event ):void 
		{
			var metaData:ID3Info;
			
			// overwrite model data (if not already present)
			trace( sound.id3 );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Failure
		// something has failed. We need to save some important information here
		/////////////////////////////////////////////////////////////////////////////////////
		private function onIOError( $event:IOErrorEvent ):void 
		{
			$event.stopImmediatePropagation();
			// check to see if we were still loading before this fail
			if ( loadProgress < 1 ) onLoadFailed();
			onFailure( new Error( $event.text, $event.errorID ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Mega Fail
		/////////////////////////////////////////////////////////////////////////////////////
		private function onFailure( $error:Error , $recoverable:Boolean=false ):void
		{
			model.isPlayable = $recoverable;
			dispatchEvent( new FailEvent( $error, false, false, $recoverable ) );
			trace( "Fail Event : " + $error.message );
		};
		
		override public function toString():String
		{
			return model.toString() + " (Active:"+super.isActive( this )+").";
		}

	}

}