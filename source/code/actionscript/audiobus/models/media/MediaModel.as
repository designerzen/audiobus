/*/////////////////////////////////////////////////////////////////////////

A Model to populate with data and feed to a datatype.

An instance of this model is passed between controllers and views.

For best results try and populate this model with as much data as possible

/////////////////////////////////////////////////////////////////////////*/
package audiobus.models.media 
{
	import audiobus.models.Model;
	
	public class MediaModel extends Model 
	{	
		public function MediaModel( $loadImmediately:Boolean = false, $playImmediately:Boolean = false ) 
		{
			autoLoad = $loadImmediately;
			autoPlay = $playImmediately;
			//trace ("crossDomain:"+crossDomain);
		};
	
		// ESSENTIAL FOR PLAYBACK! Set the URL of this
		public function get url():String {	return _url;	};
		public function set url( $url:String ):void
		{
			// first thing we do is check to see if the url contains the server string and if so swap it out
			if ( $url.indexOf( "rtmp://" ) > -1 ) 
			{
				// split apart at last / and set as server & url
				var lastSlash:Number = $url.lastIndexOf( "/" );
				// sanity check
				if ( lastSlash > 6 ) 
				{
					_server = $url.slice( 0, lastSlash + 1 );
					_url = $url.slice( lastSlash + 1, $url.length );
				}
			}else {
				_url = $url;
			}
		};
		
		// For RTMP Datatypes we also need a server set
		public function get server():String {	return _server;  };
		public function set server( $server:String ):void
		{
			// strip off or add the rtmp if not set
			_server = $server;
		}
		
		
		// MetaData ==================================================================================================
		
		// These are usually populated with metadada if not initially set here
		
		// Artist / Author / Creator / Name
		public var author:String = null;
		// Title / 
		public var title:String = null;
		// description / comments
		public var description:String = null;
		// Useful ID store for setting some unique information
		public var externalID:String = null;
		
		
		// Buffer ==================================================================================================
		// These are dynamic buffering variables
		public var bufferTime: Number = 3; 				// previously 0.1
		public var bufferTimeMax: Number = 0; 			// 0 is a good value
		public var bufferLength:Number = 0;

		public function get progress():Number{ return (duration > 0) ? position / duration : 0 ; }
		public function set position( $position:Number ):void { _position = ( $position < 0 ) ? 0 : $position; };
		public function get position():Number { return _position;  };
		
		public var duration:Number = 0;
		public var loops:Number = 0;			// Amount of times to loop this audio, 0 meaning no loop, -1 loop forever!
		
		// Some behaviours
		public var autoPlay:Boolean;
		public var autoLoad:Boolean;
		public var pauseOnBufferFull:Boolean = false; 	// NB. Only applies to RTMP
   
		// Read only conditions =====================================================================================
		public var isBuffering:Boolean = false;
		public var isPaused:Boolean = true;
		public var isPlayable:Boolean = true;
		
		// These are unique values set from the data file
		public function get loadProgress():Number{ return bytesLoaded / bytesTotal; }
		public var bytesLoaded:Number = 0;
		public var bytesTotal:Number = 0;

		// Unique IDs
		public function set id( $id:int ):void { _id = $id;  };
		public function get id():int { return _id;  };
		
		// Mixer settings ===========================================================================================
		// Regulated volume [ 0 -> 1 ] 
		public function set volume( $volume:Number ):void { _volume = ( $volume > 1) ? 1 : ( $volume < 0 ) ? 0 : $volume; };
		public function get volume():Number { return _volume;  };
		
		// Regulated pan [ -1 -> 0 -> 1 ] 
		public function set panning( $panning:Number ):void { _panning = ( $panning > 1) ? 1 : ( $panning < -1 ) ? -1 : $panning; };
		public function get panning():Number { return _panning;  };
		
		// Location settings ========================================================================================
		// Does this file live on the same domain as the swf?
		// If not set, do some simple calculations to find out if we are on the same domain
		// As the SWF is hosted on and if not, then conservatively guess true!
		public function set crossDomain( $crossDomain:Boolean ):void { _crossDomain=$crossDomain; };
		public function get crossDomain():Boolean
		{ 
			//if ( _crossDomain == null ) _crossDomain = true;
			return _crossDomain;  
		};
		
		// Internals, DO NOT Fiddle with! ===========================================================================
		private var _id:int;
		private var _url:String = null;
		private var _server:String = null;
		private var _panning:Number = 0;
		private var _volume:Number = 1;
		private var _position:Number = 0;
		private var _crossDomain:Boolean = false;
		
		// Methods ==================================================================================================
		/*
		public function clone():MediaModel
		{
			var model:MediaModel = new MediaModel(); 
			return model;
		};
		*/
		
		override public function toString():String
		{
			var output:String = "[";
			output += " URL=" + ((this.server) ? this.server : '') +this.url + " , ";
			output += " AUTHOR=" + this.author + " , ";
			output += " TITLE=" + this.title + " , ";
			output += " POSITION=" + this.position + " , ";
			output += " DURATION=" + this.duration + " , ";
			output += " PROGRESS=" + this.progress + " ";
			output += " VOLUME=" + this.volume + " ";
			return output + "]";
		};
	}

}