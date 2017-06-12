/*/////////////////////////////////////////////////////////////////////////

A base file for streaming formats in flash including RTMP streams

Extend this file for each streaming datatype that you wish to create.

Supported File Types : MP3 / MP4 / FLV / MOV / H264 / MovieStar

/////////////////////////////////////////////////////////////////////////*/
package audiobus.services.media 
{
	import audiobus.models.events.BufferingEvent;
	import audiobus.models.events.CuePointEvent;
	import audiobus.models.events.FailEvent;
	import audiobus.models.events.LoadingEvents;
	import audiobus.models.events.PositionChangeEvents;
	import audiobus.models.events.VolumeEvent;
	import audiobus.models.media.AudioModel;
	import flash.events.AsyncErrorEvent;
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.NetStatusEvent;
	import flash.events.ProgressEvent;
	import flash.events.SecurityErrorEvent;
	import flash.events.StatusEvent;
	import flash.media.SoundTransform;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	
	public class AbstractStream extends AbstractMedia implements IMediaControl, IMedia
	{
		public var model:AudioModel;
		
		private var netStream:NetStream;					// Accepts data bytes
		private var netConnection:NetConnection;			// Handshakes our server
		private var soundTransform:SoundTransform;			// Controls audio
		private var soundRequested:Boolean = false;			// Has the sound loading begun?
		private var connected:Boolean = false;
		
		
		// Volume :
		public function set volume( $volume:Number ):void
		{
			model.volume = $volume;
			if (soundTransform)
			{
				// only change it if it is different to the cached volume
				if ( soundTransform.volume != model.volume )
				{
					soundTransform.volume = model.volume;
					if (netStream)
					{
						netStream.soundTransform = soundTransform;
						dispatchEvent( new VolumeEvent( VolumeEvent.CHANGE, model.volume ) );
					}
				}
			}
		};
		
		public function get volume():Number 
		{
			if (soundTransform) model.volume = soundTransform.volume;
			return model.volume;
		};
		
		// Stereo Pan
				
		// Stereo Panning :
		// -1 = Hard Left, 0 = central, +1 = Hard Right
		public function set panning( $panning:Number ):void
		{
			model.panning = $panning;
			if (soundTransform) 
			{
				soundTransform.pan = $panning;
				netStream.soundTransform = soundTransform;
			}
		};
		public function get panning():Number 
		{
			return model.panning;
		};
		
		
		// Position in file
		public function get position():Number 
		{
			return model.position;
		}		
		public function set position($value:Number):void 
		{
			seek( $value );
		}
		
		public function get loadProgress():Number 
		{
			return model.loadProgress;
		}
		
		public function get bufferTime():Number 
		{
			if ( netStream ) return netStream.bufferTime;
			else return model.bufferTime;
		}
		
		public function get bufferLength():Number 
		{
			if ( netStream ) return netStream.bufferLength;
			else return model.bufferLength;
		}
		
		public function get duration():Number 
		{
			return model.duration;
		}
		
		public function get id():int 
		{
			return model.id;
		}
		
		public function set bufferTime( $value:Number):void 
		{
			model.bufferTime = netStream.bufferTime = $value;
		}

		public function set autoPlay( $value:Boolean ):void 
		{
			model.autoPlay = $value;
		}
		public function get isBuffering():Boolean 
		{
			return model.isBuffering;
		}
		
		public function get isPaused():Boolean 
		{
			return model.isPaused;
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Begin
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function AbstractStream( $audioModel:AudioModel ) 
		{
			model = $audioModel;
			model.id = super.createUniqueID();
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Start the Stream 
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function start($startTime:Number = -1 ):void 
		{
			var startFrom:Number = ( $startTime == -1 ) ?  model.position : $startTime;
			trace( "Start Requested from position : "+startFrom+" sound already in memory:"+soundRequested );
			
			model.position = startFrom;
			
			// If this is sat idle in memory, firstly initialise and buffer some bytes
			if (!soundRequested) create( model.bufferTime );
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Stop the Stream and reset position if possible
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function stop():void 
		{
			model.position = 0;
			if (netStream)
			{
				netStream.pause();
				netStream.seek( 0 );
			}
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		//
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function pause():void 
		{
			model.position = netStream.time * 1000;	// as it is in seconds
			model.isPaused = true;
			netStream.pause();
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		//
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function resume():void 
		{
			model.isPaused = false;
			netStream.resume();
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		//
		//////////////////////////////////////////////////////////////////////////////////////////////////
		public function togglePause():void 
		{
			netStream.togglePause();
		}
		
		public function setAutoPlay($autoPlay:Boolean):void 
		{
			
		}
		
		public function cue($bufferTime:Number = 3000):void 
		{
			
		}	
		
		// Jump to a specific position in this file
		public function seek( $position:Number ):void 
		{
			if (!netStream) return void;
			model.position = $position;
			netStream.seek( $position );
		}
		
		public function unload():void 
		{
			
		}
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Create a Sound object in memory and wire it up!
		//////////////////////////////////////////////////////////////////////////////////////////////////
		override protected function create( $bufferTime:Number=0 ):void
		{
			// set as active
			super.create();
			
			// If we haven't already, lets create a sound transform instance to handle individual volumes & panning
			soundTransform = new SoundTransform( model.volume, model.panning );
			soundTransform.volume = model.volume;
			
			// add event listeners to handle logic
			netConnection = new NetConnection();
			netConnection.addEventListener( SecurityErrorEvent.SECURITY_ERROR, onSecurityFailure, false, 0, true);
			netConnection.addEventListener( AsyncErrorEvent.ASYNC_ERROR, onAsyncError, false, 0, true);
			netConnection.addEventListener( IOErrorEvent.IO_ERROR, onIOError, false, 0, true);
			netConnection.addEventListener( NetStatusEvent.NET_STATUS, onNetStatus, false, 0, true);
			// Handshake with server
			netConnection.connect( model.server );
			
			// as we have loaded some into memory, upade request flag
			soundRequested = true;
			
			onBufferingBegin();
			onLoadBegin();
		};
		
		//////////////////////////////////////////////////////////////////////////////////////////////////
		// Free up memory by destroying all but the sparcest of data
		//////////////////////////////////////////////////////////////////////////////////////////////////
		override protected function destroy():void
		{
			// set as inactive
			super.destroy();
			
			if ( netStream )
			{
				netStream.close();
				netStream = null;
			}
			
			// remove listeners
			netConnection.removeEventListener( SecurityErrorEvent.SECURITY_ERROR, onSecurityFailure );
			netConnection.removeEventListener( AsyncErrorEvent.ASYNC_ERROR, onAsyncError );
			netConnection.removeEventListener( IOErrorEvent.IO_ERROR, onIOError );
			netConnection.removeEventListener( NetStatusEvent.NET_STATUS, onNetStatus );
			netConnection = null;
			
			// clear objects in memory
			soundTransform = null;
			
			// reset parameters
			soundRequested = false;
			connected = false;
			model.bytesLoaded = 0;
			model.position = 0;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Event Handlers :
		/////////////////////////////////////////////////////////////////////////////////////
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Net Connection Status
		/////////////////////////////////////////////////////////////////////////////////////
		private function onNetStatus( $event:NetStatusEvent ):void
		{
			//trace( "NetConnection Status : " + $event.info.code+ " the reason is "+$event.info.reason );
			switch ( $event.info.code )
			{
				// Result!
				case "NetConnection.Connect.Success":
					onConnectionEstablished();
					break;
					
				// Net Connection handshake failed, possibly cross domain,
				// Possible incorrect server set up
				case "NetConnection.Connect.Rejected":					
					onConnectionFailed("The connection was rejected"); 
					break; 	
					
				// This is triggered when the sound loses the connection with the server.
				// In some cases one could just try to reconnect to the server and resume playback.
				// However for streams protected by expiring tokens, I don't think that will work.
				//
				// Flash says that this is not an error code, but a status code...
				// should this call the onFailure handler?
				// Not success but not fail
				case "NetConnection.Connect.Closed":
					//onConnectionFailed( "Connection Closed" );
					break;
					
				// Couldn't establish a connection with the server. Attempts to connect to the server
				// can also fail if the permissible number of socket connections on either the client
				// or the server computer is at its limit.  This also happens when the internet
				// connection is lost.
				case "NetConnection.Connect.Failed":
					onConnectionFailed( "Connection Failed to Server" );
					break;
				
				// A change has occurred to the network status. This could mean that the network
				// connection is back, or it could mean that it has been lost...just try to resume
				// playback.

				// TODO: Can't use this yet because by the time you get your connection back the
				// song has reached it's maximum retries, so it doesn't retry again.  We need
				// a new _ondisconnect handler.
				case "NetConnection.Connect.NetworkChange":
					break;
					
					
				// Everything else is more than likely a FAILURE!
				default:
					onFailure( new Error( $event.info.code ) );
					break;
			}
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Net Stream Status 
		/////////////////////////////////////////////////////////////////////////////////////
		private function onStreamStatus( $event:NetStatusEvent ):void 
		{
			trace( "NetStream Status : " + $event.info.code + ", reason:" + $event.info.reason );
			switch ( $event.info.code )
			{
				// The playlist has reset (pending play commands have been flushed).
				case "NetStream.Play.Reset": 
					
					break; 
					
				// Playback has started. 
				// This information object also has a details property, 
				// a string that provides the name of the stream currently 
				// playing on the NetStream. 
				// If you are streaming a playlist that contains multiple streams, 
				// this information object is sent each time you begin playing a different stream in the playlist.
				case "NetStream.Play.Start": 
					onBegin( );
					break; 
					
				// Playback has stopped. This message is sent from the server.
				case "NetStream.Play.Stop": 
					
					break; 	
				
				// The subscriber has paused playback.	
				case "NetStream.Pause.Notify":
					break;
				
				// The subscriber has resumed playback.
				case "NetStream.Unpause.Notify":
					break;
					
				// The subscriber has used the seek command to move to a particular location in the recorded stream.
				case "NetStream.Seek.Notify":
					onProgress();
					break;
				
				// The subscriber tried to use the seek command to move to a particular location in the recorded stream, but failed.
				case "NetStream.Seek.Failed":
					onProgress();
					break;
					
				// Flash Player does not detect any supported tracks (video, audio or data) 
				// and will not try to play the file. Supported by Flash Player 9 Update 3 and later.
				case "NetStream.Play.Failed":
					break;
					
				// Buffer EMPTY
				// Data is not being received quickly enough to fill the buffer. 
				// Data flow is interrupted until the buffer refills, at which time a 
				// NetStream.Buffer.Full message is sent and the stream begins playing again.
				case "NetStream.Buffer.Empty": 
					onBufferingBegin();
					break; 
				
				// Buffer FULL
				// The buffer is full and the stream begins playing. 
				case "NetStream.Buffer.Full": 
					onBufferingEnd();
					break;
					
				// Buffer EMPTIED due to completition
				// Data has finished streaming, and the remaining buffer will be emptied.
				case "NetStream.Buffer.Flush":
					break;
				
				// ERRORS : 
				// =================================================================
				
				// Flash Player detects an invalid file structure and will not try to play this type of file. Supported by Flash Player 9 Update 3 and later.
				case "NetStream.Play.FileStructureInvalid":
					onLoadFailed();
					onFailure( new Error( "File Structure Invalid" ) , false );
					break;

				// The client tried to play a live or recorded stream that does not exist.
				case "NetStream.Play.StreamNotFound":
					onLoadFailed();
					onFailure( new Error( "Stream not found" ) , false );
					break;
					
				// Data is playing behind the normal speed.
				case "NetSream.Play.InsufficientBW":
					onFailure( new Error( "Insufficient Bandwidth" ) , true );
					break;
					
				// An error has occurred for a reason other than those listed, 
				// such as the subscriber trying to use the seek command to move to a 
				// particular location in the recorded stream, but with invalid parameters.
				// This information object also has a description property, 
				// which is a string that provides a more specific reason for the failure.
				case "NetStream.Failed":
					onFailure( new Error( $event.info.description ) , false );
					break;
					
				// ==================================================================
				
				/*
				 
				The client tried to play a live or recorded stream that does not exist.

				NetStream.Play.NoSupportedTrackFound
					
				NetStream.Play.PublishNotify
				Publishing has begun; this message is sent to all subscribers.

				NetStream.Play.UnpublishNotify
				Publishing has stopped; this message is sent to all subscribers.

				NetStream.Publish.BadName
				The client tried to publish a stream that is already being published by someone else.

				NetStream.Publish.Idle
				The publisher of the stream has been idle for too long.

				NetStream.Publish.Start
				Publishing has started.

				NetStream.Record.Failed
				An error has occurred in recording for a reason other than those listed elsewhere in this table; 
				for example, the disk is full.

				This information object also has a description property, 
				which is a string that provides a more specific reason for the failure.

				NetStream.Record.NoAccess
				The client tried to record a stream that is still playing, or the client tried to record (overwrite) a stream that already exists on the server with read-only status.

				NetStream.Record.Start
				Recording has started.

				NetStream.Record.Stop
				Recording has stopped.

				NetStream.Unpublish.Success
				Publishing has stopped.*/	
			}	
		};
		
		
		/*
		public function netStatusHandler(event:NetStatusEvent):void {

      switch (event.info.code) {

        case "NetConnection.Connect.Success":
          try {
            this.ns = new NetStream(this.nc);
            this.ns.receiveAudio(true);
            this.addNetstreamEvents();
            this.connected = true;
            
          } catch(e: Error) {
            this.failed = true;
            writeDebug('netStream error: ' + e.toString());
            ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", 'Connection failed!', event.info.level, event.info.code);
          }
          break;

        case "NetStream.Play.StreamNotFound":
          this.failed = true;
          writeDebug("NetConnection: Stream not found!");
          ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", 'Stream not found!', event.info.level, event.info.code);
          break;

        // This is triggered when the sound loses the connection with the server.
        // In some cases one could just try to reconnect to the server and resume playback.
        // However for streams protected by expiring tokens, I don't think that will work.
        //
        // Flash says that this is not an error code, but a status code...
        // should this call the onFailure handler?
        case "NetConnection.Connect.Closed":
          this.failed = true;
          ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", 'Connection closed!', event.info.level, event.info.code);
          writeDebug("NetConnection: Connection closed!");
          break;

        // Couldn't establish a connection with the server. Attempts to connect to the server
        // can also fail if the permissible number of socket connections on either the client
        // or the server computer is at its limit.  This also happens when the internet
        // connection is lost.
        case "NetConnection.Connect.Failed":
          this.failed = true;
          writeDebug("NetConnection: Connection failed! Lost internet connection? Try again... Description: " + event.info.description);
          ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", 'Connection failed!', event.info.level, event.info.code);
          break;

        // A change has occurred to the network status. This could mean that the network
        // connection is back, or it could mean that it has been lost...just try to resume
        // playback.

        // KJV: Can't use this yet because by the time you get your connection back the
        // song has reached it's maximum retries, so it doesn't retry again.  We need
        // a new _ondisconnect handler.
        //case "NetConnection.Connect.NetworkChange":
        //  this.failed = true;
        //  writeDebug("NetConnection: Network connection status changed");
        //  ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", 'Reconnecting...');
        //  break;

        // Consider everything else a failure...
        default:
          this.failed = true;
          writeDebug("NetConnection: got unhandled code '" + event.info.code + "'! Description: " + event.info.description);
          ExternalInterface.call(baseJSObject + "['" + this.sID + "']._onfailure", '', event.info.level, event.info.code);
          break;
      }
	*/
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Net Connection has been established with the remote server
		/////////////////////////////////////////////////////////////////////////////////////
		private function onConnectionEstablished():void
		{
			// Create a new Client Proxy to manage updates and events
			var client:Client = new Client( this );
			
			// create a new netstream to handle our business...
			try {
				netStream 					= new NetStream( netConnection, NetStream.CONNECT_TO_FMS );
				netStream.soundTransform 	= soundTransform;
				netStream.checkPolicyFile 	= model.crossDomain;
				netStream.bufferTime 		= model.bufferTime;		// set to 0.1 or higher. 0 is reported to cause playback issues with static files.
				netStream.bufferTimeMax 	= model.bufferTimeMax; 	// maximum time that the buffer extends too
				netStream.client 			= client;
				trace( 'netStream.checkPolicyFile:'+netStream.checkPolicyFile);
				netStream.addEventListener( NetStatusEvent.NET_STATUS, onStreamStatus );
				//netStream.addEventListener( StatusEvent.STATUS, onStreamStatus );
				netStream.receiveAudio(true);

				if ( soundRequested )
				{
					//netStream.play2();
					netStream.soundTransform = soundTransform;
					netStream.play( model.url );
					netStream.seek( model.position * 0.001 );
				}
				
				// Connection success!
				connected = true;
			}catch ( $error:Error ) {
				onConnectionFailed( $error.message );
			}
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Net Connection could not be established, 
		/////////////////////////////////////////////////////////////////////////////////////
		private function onConnectionFailed( $errorMessage:String ):void
		{
			connected = false;
			onLoadFailed();
			onFailure( new Error( $errorMessage ), false );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Load Begins
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadBegin():void 
		{
			dispatchEvent( new LoadingEvents( LoadingEvents.BEGIN, false, false, model.bytesLoaded, model.bytesTotal ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Loading...
		/////////////////////////////////////////////////////////////////////////////////////
		private function onLoadProgress( $event:ProgressEvent ):void 
		{
			model.bytesLoaded = $event.bytesLoaded;
			model.bytesTotal = $event.bytesTotal;
			dispatchEvent( new ProgressEvent( ProgressEvent.PROGRESS, false, false, model.bytesLoaded, model.bytesTotal ) );
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
		// Beginning
		/////////////////////////////////////////////////////////////////////////////////////
		private function onBegin():void 
		{		
			dispatchEvent( new PositionChangeEvents( model.position, model.duration, PositionChangeEvents.BEGIN ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Playing...
		/////////////////////////////////////////////////////////////////////////////////////
		private function onProgress():void 
		{
			dispatchEvent( new PositionChangeEvents( model.position, model.duration, PositionChangeEvents.CHANGE ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Completed the track
		/////////////////////////////////////////////////////////////////////////////////////
		public function onComplete( $event:Event=null ):void 
		{
			dispatchEvent( new PositionChangeEvents( model.position, model.duration, PositionChangeEvents.COMPLETE ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Meta Data Received
		/////////////////////////////////////////////////////////////////////////////////////
		public function onMetaData( $info:Object ):void 
		{
			trace("metadata: duration=" + $info.duration + " width=" + $info.width + " height=" + $info.height + " framerate=" + $info.framerate);
			// overwrite model data
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Cue Point reached! (dispatched from Client)
		/////////////////////////////////////////////////////////////////////////////////////
		public function onCuePoint( $info:Object ):void 
		{
			trace("cuepoint: time=" + $info.time + " name=" + $info.name + " type=" + $info.type);
			dispatchEvent( new CuePointEvent( $info.time, $info.name ) );
		};
		
		// ERROR Events =========================================================================
		
		/////////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////////
		private function onSecurityFailure(e:SecurityErrorEvent):void 
		{
			// TODO : attempt to reload with crossdomain enabled
		}	
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Failure
		/////////////////////////////////////////////////////////////////////////////////////
		private function onAsyncError( $event:AsyncErrorEvent=null ):void 
		{
			var error:Error = $event.error;
			$event.stopImmediatePropagation();
			onFailure( error );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// something has failed. We need to save some important information here	
		/////////////////////////////////////////////////////////////////////////////////////
		private function onIOError( $event:IOErrorEvent ):void 
		{
			var error:Error = new Error( $event.text, $event.errorID );
			$event.stopImmediatePropagation();
			onFailure( error )
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Ultimate Fail
		/////////////////////////////////////////////////////////////////////////////////////
		private function onFailure( $error:Error , $recoverable:Boolean=false ):void
		{
			model.isPlayable = $recoverable;
			dispatchEvent( new FailEvent( $error, false, false, $recoverable ) );
			// clear any memory caches pertaining to this instance
			destroy();
			//trace( "Fail Event : " + $error.message );
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Debug
		/////////////////////////////////////////////////////////////////////////////////////
		override public function toString():String
		{
			return model.toString() + " (Active:"+super.isActive( this )+").";
		}
		
	}
}

import audiobus.services.media.AbstractStream;
internal class Client extends Object
{
	private var parent:AbstractStream;
	//public var audioSampleAccess:String = "publicdomain"; 
	public function Client( $parent:AbstractStream )
	{
		parent = $parent;
	}
	
	// Meta Data updated
	public function onMetaData( $info:Object ):void	{ parent.onMetaData( $info ); }

	// When a cue point has been encountered during playback
	public function onCuePoint( $info:Object ):void{ parent.onCuePoint( $info ); }
	
	// Image Meta Data Received
	public function onImageData( $imageData:Object ):void 
	{
        trace("imageData length: " + $imageData.data.length);
    }
	
	// Seeking complete
	public function onSeekPoint( $info:Object ):void 
	{
		//parent.
	}

	// Called :
	// After a stream transition (ie. from high to low bandwidth etc)
	// When Stream has Completed
	public function onPlayStatus( $info:Object ):void 
	{ 
		trace("switch time: time=" + $info.time + " name=" + $info.name + " type=" + $info.type + " reason="+ $info.reason ); 
		switch ( $info.code ) 
		{ 
			case "NetStream.Play.Complete": 
				trace("The stream has completed"); 
				parent.onComplete();
				break; 
				
			// The subscriber is switching from one stream to another in a playlist.
			// Switch streams because of bandwidth issues
			case "NetStream.Play.Switch": 
				trace("The stream has switched"); 
				break; 	
				
			// The subscriber is switching to a new stream as a result of stream bit-rate switching
			case "NetStream.Play.TransitionComplete":
				trace("The stream has switched - completed transaction"); 
				break;
		} 
	};
	
	// Other types of cue point data
	public function onTextData( $info:Object ):void { };
	public function onXMPData( $info:Object ):void { };	
	public function onHeaderData( $info:Object ):void { };	
}