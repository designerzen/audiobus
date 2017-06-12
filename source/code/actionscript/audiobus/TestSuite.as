package audiobus
{
	// Media Views 
	import audiobus.views.AbstractFacade;
	import audiobus.views.mediators.MediaPlayer;

	// Media Models & Events
	import audiobus.models.events.AvailabilityEvent;
	import audiobus.models.events.BufferingEvent;
	import audiobus.models.events.FailEvent;
	import audiobus.models.events.LoadingEvents;
	import audiobus.models.events.PositionChangeEvents;	
	import audiobus.models.events.VolumeEvent;
	import audiobus.models.media.AudioModel;
	import audiobus.models.media.MediaModel;
	
	// Media Controllers & Input
	import audiobus.controllers.input.html.FlashVars;
	import audiobus.controllers.input.keyboard.KeyboardHandler;
	import audiobus.controllers.media.Mixer;
	import audiobus.controllers.media.IPlaylist;
	import audiobus.controllers.media.Playlist;
	import audiobus.controllers.media.PlaylistSeamless;
	import audiobus.controllers.media.SpectrumAnalyser;
	
	// Media Services
	import audiobus.services.media.IMediaControl;
	import audiobus.services.media.MP3;
	import audiobus.services.media.RTMP;	
	import audiobus.services.webServices.IWebService;
	import audiobus.services.webServices.XSPFWebService;
	import audiobus.services.webServices.archive.ArchiveAudio;
	import audiobus.services.webServices.nomadRadio.NomadRadioAPI;
	
	import flash.utils.setTimeout;
	import flash.display.Sprite;
	import flash.events.Event;
	import flash.system.Security;
//	import com.sociodox.theminer.TheMiner;
	import flash.events.ProgressEvent;
	import flash.external.ExternalInterface;
	
	public class TestSuite extends AbstractFacade 
	{
		private var keyHandler:KeyboardHandler;
		private var sound:IMediaControl;
		private var playlist:Playlist;
		private var useJS:Boolean = true;
		
		// flash vars
		private var nameSpace:String;
		private var volume:Number;

		// js vars
		private var eqData:String;
		private var crossDomain:String = '*';
		private var mediaPlayer:MediaPlayer;
		
		public function TestSuite():void 
		{
			super();
		};

		override protected function initialise():void 
		{
			// fetch flash vars from html source
			var flashVars:FlashVars = new FlashVars( this.stage );
			nameSpace = flashVars.fetchVar( 'nameSpace', 'audioBus' );
			volume = Number( flashVars.fetchVar( 'volume', '0.5' ) );
			// start here
			begin();
		};
		
		private function begin():void
		{
			//this.addChild(new TheMiner(true));
			test();
			//addEventListener
		};
		
		// Tests!
		private function test():void
		{
			/*
			var loader:ArchiveAudio = new ArchiveAudio();
			loader.addEventListener( LoadingEvents.COMPLETE, onWebServiceLoaded );
			loader.loadService( "default" );
			//loader.load( "", false, 9000 );
			*/
			
			mediaPlayer = new MediaPlayer( stage.stageWidth, stage.stageHeight);
			addChild( mediaPlayer );
			
			/*
			var nomad:NomadRadioAPI = new NomadRadioAPI();
			nomad.addEventListener( LoadingEvents.PROGRESS, onWebServiceLoading );
			nomad.addEventListener( LoadingEvents.COMPLETE, onWebServiceLoaded );
		//	nomad.addEventListener( AvailabilityEvent.AVAILABLE, onWebServiceLoaded );
			nomad.loadService( "w", true );
			*/
			
			/*
			var xspfLoader:XSPFWebService = new XSPFWebService();
			xspfLoader.addEventListener( LoadingEvents.PROGRESS, onWebServiceLoading );
			xspfLoader.addEventListener( LoadingEvents.COMPLETE, onWebServiceLoaded );
			xspfLoader.loadService( "media/xspf/buddha.xspf", false );
			*/
			
			// Playlist
			playlist 			= new Playlist( false, false, false );
			//playlist 			= new PlaylistSeamless( false, false, false );
			playlist.volume 	= volume;
			playlist.addEventListener( VolumeEvent.CHANGE, onVolumeChanged );
			playlist.addEventListener( PositionChangeEvents.BEGIN, onPositionChanged );
			playlist.addEventListener( PositionChangeEvents.CHANGE, onPositionChanged );
			playlist.addEventListener( PositionChangeEvents.COMPLETE, onPositionChanged );
			playlist.addEventListener( BufferingEvent.BUFFERING_BEGUN, onBuffering );
			playlist.addEventListener( BufferingEvent.BUFFERING_END, onBuffering );
			playlist.addEventListener( LoadingEvents.BEGIN, onLoading );
			playlist.addEventListener( LoadingEvents.PROGRESS, onLoading );
			playlist.addEventListener( LoadingEvents.COMPLETE, onLoading );
			playlist.addEventListener( LoadingEvents.FAILED, onLoading );
			playlist.addEventListener( FailEvent.FAIL, onFailure );
			
			
			
			// MP3 :
			var mp3:AudioModel 	= new AudioModel();
			mp3.volume 			= 0.1;
			mp3.bufferTime 		= 0;
			mp3.bufferTimeMax 	= 0;	
			mp3.url 			= "media/mp3/select.mp3";
			mp3.crossDomain 	= true;
			//mp3.url 			= "media/mp3/1hz-10khz-sweep.mp3";
			sound = new MP3( mp3 );
			playlist.append( sound );
			/*
			// MP3 :
			var phaseTest:AudioModel 	= new AudioModel();
			phaseTest.volume 			= 1;
			phaseTest.bufferTime 		= 5;
			phaseTest.bufferTimeMax 	= 5;	
			phaseTest.url 				= "media/mp3/1hz-10khz-sweep.mp3";
			sound = new MP3( phaseTest );
			playlist.append( sound );
			
			*/
			
			/*
			// RTMP :
			var rtmp:AudioModel = new AudioModel();
			rtmp.volume 		= 1;
			rtmp.bufferTime 	= 3;
			rtmp.bufferTimeMax 	= 5;	
			rtmp.crossDomain 	= true;
			rtmp.url 			= "rtmp://edge2.mixlr.com/live/production/3c38da32ec2b8d79faf06a98f500b47d";
			sound = new RTMP( rtmp );
			playlist.append( sound );
			
			
			// MP3 :
			var ambient:AudioModel 	= new AudioModel();
			ambient.volume 			= 0.1;
			ambient.bufferTime 		= 3;
			ambient.bufferTimeMax 	= 5;	
			ambient.url 			= "./media/mp3/rain.mp3";
			sound = new MP3( ambient );
			playlist.append( sound );
			//trace( sound );
			
			ambient 				= new AudioModel();
			ambient.url 			= "./media/mp3/coins.mp3";
			ambient.volume 			= 0.1;
			playlist.append( new MP3( ambient ) );	
			*/
			
			/*
			// Broken File :
			var error:AudioModel 	= new AudioModel();
			error.volume 			= 1;
			error.bufferTime 		= 0;
			error.bufferTimeMax 	= 0;	
			error.url 				= "media/mp3/404.mp3";
			sound = new MP3( error );
			playlist.append( sound );
			*/
			
			/*
			ambient 				= new AudioModel();
			ambient.url 			= "./media/mp3/880hz.mp3";
			ambient.url 			= "./media/mp3/rain.mp3";
			ambient.volume 			= 0.1;
			
			playlist.append( new MP3( ambient ) );			
			playlist.append( new MP3( ambient ) );			
			playlist.append( new MP3( ambient ) );			
			//playlist.append( new MP3( ambient ) );
		*/
			
			/*
			
			sound.addEventListener( VolumeEvent.CHANGE, onVolumeChanged );
			sound.addEventListener( PositionChangeEvents.BEGIN, onPositionChanged );
			sound.addEventListener( PositionChangeEvents.CHANGE, onPositionChanged );
			sound.addEventListener( PositionChangeEvents.COMPLETE, onPositionChanged );
			sound.addEventListener( BufferingEvent.BUFFERING_BEGUN, onBuffering );
			sound.addEventListener( BufferingEvent.BUFFERING_END, onBuffering );
			sound.addEventListener( LoadingEvents.BEGIN, onLoading );
			sound.addEventListener( LoadingEvents.PROGRESS, onLoading );
			sound.addEventListener( LoadingEvents.COMPLETE, onLoading );
			sound.addEventListener( LoadingEvents.FAILED, onLoading );
			sound.addEventListener( FailEvent.FAIL, onFailure );
			sound.start();

			*/
			
			
			addHotkeys();
			
			setUpGateway();
			
			
			
			addChild( mediaPlayer );
			
			
			
			playlist.start();
			
			// begin spectrum analysis
			// setTimeout( fetchSpectrum, 1000 );
			// fetchSpectrum();
		};
		
		
		private function increaseVolume( $quantity:Number=0.1 ):void
		{
			Mixer.volume += $quantity;
		};
		private function decreaseVolume( $quantity:Number=0.1 ):void
		{
			Mixer.volume -= $quantity;
		};
		private function fastForward( $seconds:Number = 100 ):void
		{
			sound.position += $seconds;
		};
		private function rewind( $seconds:Number = 100 ):void
		{
			sound.position -= $seconds;
		};
		private function addHotkeys():void 
		{
			keyHandler = new KeyboardHandler( stage, false, true );
			//keyHandler.addKeyCombo( sound.start, 83 );			// s
			keyHandler.addKeyCombo( sound.start, 's' );				// s
			keyHandler.addKeyCombo( sound.stop, 's+shift' );		// s & shift
			//keyHandler.addKeyCombo( sound.pause, 'p' );				// p	
			//keyHandler.addKeyCombo( sound.resume, 'p+shift' );		// p & shift	
			//keyHandler.addKeyCombo( sound.resume, 'r' );			// r
			//keyHandler.addKeyCombo( sound.togglePause, 't' );		// t
			
			keyHandler.addKeyCombo( playlist.pause, 'p' );		// t
			keyHandler.addKeyCombo( playlist.resume, 'p+shift' );		// t
			keyHandler.addKeyCombo( playlist.resume, 'r' );		// t
			keyHandler.addKeyCombo( playlist.togglePause, 't' );		// t
			
			keyHandler.addKeyCombo( increaseVolume, 'v' );			// vg
			keyHandler.addKeyCombo( increaseVolume, 'up' , 0.1);	// ↑
			keyHandler.addKeyCombo( decreaseVolume, 'v+shift');		// v & shift
			keyHandler.addKeyCombo( decreaseVolume, 'down', 0.1);	// ↓
			
			keyHandler.addKeyCombo( fastForward, 'right' );			// →
			keyHandler.addKeyCombo( rewind, 'left' );				// ←

			keyHandler.addKeyCombo( playlist.previous, 'l' );		// l
			keyHandler.addKeyCombo( playlist.next, 'n' );			// n
			
			keyHandler.addKeyCombo( trace, 'b', sound.bufferTime );	// b
			keyHandler.addKeyCombo( trace, 'g', playlist );	// b
			
			// Contra Code!S
			//keyHandler.addKeyCombo( contra, 'up,up,down,down,left,right,left,right,b,a');	// ↓
			
			// ↑↑↓↓←→←→BA
			
			/*
			keyHandler.addKeyCombo( sound.stop, 68 );				// d
			keyHandler.addKeyCombo( sound.stop, '68+d' );				// d
			keyHandler.addKeyCombo( sound.stop, 'h+j+l' );				// d
			keyHandler.addKeyCombo( sound.stop, [ 69,70,71] );			// d
			keyHandler.addKeyCombo( sound.stop, 'a|b|c' );			// d
			keyHandler.addKeyCombo( sound.stop, 'x,y,z' );			// d
			keyHandler.addKeyCombo( sound.stop, 'x,y,z|a,b,c' );			// d
			*/
		}
		
		private function setUpGateway():Boolean 
		{
			if ( !ExternalInterface.available ) 
			{
				useJS = false;
				return false;
			}
			
			log( "FLASH: SWF Loaded and Ready! on " + ExternalInterface.objectID + " namespace : " + nameSpace );
			//trace( "console.log", "FLASH: SWF Loaded and Ready!" + nameSpace );
			
			// ExternalInterface.call( "log", "FLASH: SWF Loaded and Ready!" );

			// calls from javascript
			ExternalInterface.addCallback( "fetchSpectrum", fetchSpectrumData );
			ExternalInterface.addCallback( "trace", log );
			ExternalInterface.addCallback( "append", append );
			ExternalInterface.addCallback( "resume", playlist.resume );
			ExternalInterface.addCallback( "start", playlist.start );
			ExternalInterface.addCallback( "stop", playlist.stop );
			ExternalInterface.addCallback( "pause", playlist.pause );
			ExternalInterface.addCallback( "previous", playlist.previous );
			ExternalInterface.addCallback( "next", playlist.next );
			ExternalInterface.addCallback( "toString", playlist.toString );
			ExternalInterface.addCallback( "destroy", destroy );
			ExternalInterface.addCallback( "exit", onExit );
			
			// BRIDGE ESTABLISHED! Now BIND
			// Call to javascript
			ExternalInterface.call( nameSpace + "."+"onFlashReady" );
			
			return true;
		}
		
		// Clean up in preperation to remove this from memory
		private function destroy():void 
		{
			playlist.stop();
		}
		
		
		private function append( $object:* ):void 
		{
			// try and create a file from this pbject
			var model:AudioModel = new AudioModel();
			model.url = $object.url;
			var track:IMediaControl = new MP3( model, true, true );
			playlist.append( track );
		}
		
		private function log( $message:String ):void 
		{
			trace( $message );
			if (useJS) ExternalInterface.call( "console.log", $message );
			
		}
		
		// CALLED BY JAVASCRIPT!
		private function fetchSpectrumData( callbackMethodName:String="onEQData" ):String
		{
			//trace ( "Spectrum :" + SpectrumAnalyser.isAvailable );
			var eq:String = SpectrumAnalyser.spectrum.toString();
			// ExternalInterface.call( nameSpace + "."+callbackMethodName, "@eq dataset@" );
			return eq; 
		}
		
		private function fetchSpectrum():void
		{
			//eqData = SpectrumAnalyser.spectrum.toString();
			//trace ( "Spectrum :"+eqData );
			//trace ( SpectrumAnalyser.isAvailable + ", Spectrum :"+SpectrumAnalyser.spectrum );
			//trace ( "WaveForm :"+SpectrumAnalyser.waveForm );
			//setTimeout( fetchSpectrum, 100 );
		}
		
		// EVENTS :
		
		private function onWebServiceLoading( $event:LoadingEvents):void 
		{
			//trace( $event );
		}
		
		private function onWebServiceLoaded( $event:LoadingEvents ):void 
		{
			var loader:IWebService = IWebService($event.currentTarget);
			loader.removeEventListener( LoadingEvents.COMPLETE, onWebServiceLoaded );
			loader.removeEventListener( LoadingEvents.PROGRESS, onWebServiceLoading );
			
			trace( "Webservice "+loader.type+" loaded : "+loader.data );
			
			switch ( loader.type )
			{
				case "XSPFWebService":
					addToPlaylist( loader.data );
					break;
				case "ArchiveAudio":
					break;
				case "NomadRadioAPI":
					addToPlaylist( loader.data );
					break;
			}
			
			//trace( "Webservice "+loader.type+" loaded " );
		}
		
		private function addToPlaylist( $data:Vector.<AudioModel> ):void 
		{
			// loop through collection
			for each ( var item:AudioModel in $data )
			{
				var media:MP3 = new MP3( item, true, false );
				playlist.append( media );
				trace( media );
			}
			trace( playlist );
		}
		
		private function onLoading( $event:LoadingEvents ):void 
		{
			//trace( $event.type + " [" + ($event.percentage*100) + "%]");
			switch( $event.type )
			{
				case LoadingEvents.BEGIN:
					//trace("\n=================================");
					mediaPlayer.item = playlist.currentItem;
					break;
				case LoadingEvents.PROGRESS:
					if (useJS) ExternalInterface.call( nameSpace + "." + "onTrackLoading", $event.type );
			
					break;
				case LoadingEvents.COMPLETE:
					break;
				case LoadingEvents.FAILED:
					
					break;
			}
		};
		
		private function onBuffering( $event:BufferingEvent ):void 
		{
			switch( $event.type )
			{
				case BufferingEvent.BUFFERING_BEGUN:
					//trace( "Buffering Begins <-----------------------" );
					mediaPlayer.showLoader();
					break;
				case BufferingEvent.BUFFERING_END:
					//trace( "Buffering Ends ---------------------->" );
					mediaPlayer.hideLoader();
					break;
			}
			trace( "Buffer Time : "+sound.bufferTime + " Length : " + sound.bufferLength );
		};
		
		private function onPositionChanged( $event:PositionChangeEvents ):void 
		{
			//trace( "EVENT : Position Changed to " + $event.position+ " via "+$event.type );
			switch ( $event.type )
			{
				case PositionChangeEvents.BEGIN :
					trace("======================== Setting sound to "+playlist.currentItem );
					sound = playlist.currentItem;
					break;
				case PositionChangeEvents.COMPLETE :
					mediaPlayer.onComplete();
					break;
					
			}
			mediaPlayer.position = playlist.currentItem.position / playlist.currentItem.duration;
			if (useJS) ExternalInterface.call( nameSpace + "."+"onTrackProgress", $event.type );
		};
		
		private function onVolumeChanged( $event:VolumeEvent ):void 
		{
			//trace( "EVENT : Volume Changed to " + $event.volume );
			mediaPlayer.volume = $event.volume;
		};
		
		private function onFailure( $event:FailEvent ):void 
		{
			var error:Error = $event.error;
			trace( "Test Suite : " + error );
			if (useJS) ExternalInterface.call( nameSpace + "."+"onTrackFailed", $event.error );
		};
		
		
		private function onExit():void 
		{
			
		}
		
	}

}