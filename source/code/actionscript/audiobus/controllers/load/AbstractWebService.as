/*/////////////////////////////////////////////////////////////////////

This Abstract Service Loads in any webservice style web data
such as XML and JSON.

Using a generic object loader, it simply loads a url into byte
memory ready for further access and dispatches events en-route.

Either extend this or compose with it :)

@version	: 1.1
@date		: 05.03.12
@author 	: designerzen

/////////////////////////////////////////////////////////////////////*/
package audiobus.controllers.load 
{
	import audiobus.models.events.AvailabilityEvent;
	import audiobus.models.events.FailEvent;
	import audiobus.models.events.LoadingEvents;
	import flash.events.ProgressEvent;
	
	import flash.net.URLLoaderDataFormat;
	import flash.net.URLVariables;
	import flash.utils.clearTimeout;
	import flash.utils.getQualifiedClassName;
	import flash.utils.setTimeout;
	
	import flash.events.Event;
	import flash.events.EventDispatcher;
	import flash.events.HTTPStatusEvent;
	import flash.events.IEventDispatcher;
	import flash.events.IOErrorEvent;
	import flash.events.SecurityErrorEvent;
	
	import flash.net.URLLoader;
	import flash.net.URLRequest;
	
	public class AbstractWebService extends EventDispatcher implements ILoader
	{
		// Default settings :
		public static const DEFAULT_LOAD_TIMEOUT:Number = 3000;	// time before we stop trying to load in the data
		
		// Internal Vars
		protected var content:Object;							// the data that is loaded in!
		protected var loader:URLLoader;							// loader instance that handles loading in data
		
		private var severStatus:String;							// current sever return message (400, 404, 500 etc)
		
		private var startRequested:Boolean;						// have we attempted to load this data?
		private var hasLoaded:Boolean;							// has this loader completed loading?
		
		private var loadTimeOut:Number;							// amount of time to check on the server to see if file exists
		private var loadErrorInterval:int;						// numbered interval that is getting polled per execution
		
		// PUBLIC METHODS ===================================================================
		
		// What data has downloaded?
		public function get data():*			{		return (loader) ? loader.data : content; };
		public function get dataFormat():String {		return (loader) ? loader.dataFormat : URLLoaderDataFormat.BINARY; };
		
		// Is this loader actually active?
		public function get isLoading():Boolean {		return (startRequested && !hasLoaded) ? true : false; };
		
		// Has this loader completed?
		public function get isLoaded():Boolean {		return hasLoaded; };
		
		// How many bytes have been downloaded from the URL?
		public function get bytesLoaded():Number {		return (loader) ? loader.bytesLoaded : 0; };
		
		// How many bytes are we expecting in full for the URL?
		public function get bytesTotal():Number {		return (loader) ? loader.bytesTotal : 0; };
		
		// What percentage has downloaded?
		public function get progress():Number {			return this.bytesLoaded / this.bytesTotal; };
		
		// Server message
		public function get status():String {			return severStatus; };
		
		// Fetch Service Type
		public function get type():String 
		{				
			var className:String = getQualifiedClassName( this ); 
			var classChunks:Array = className.split( "::" );
			return classChunks[ classChunks.length-1 ];
		};
			
		//////////////////////////////////////////////////////////////////////
		// Construct
		//////////////////////////////////////////////////////////////////////
		public function AbstractWebService( $timeOut:Number = DEFAULT_LOAD_TIMEOUT ) 
		{
			startRequested = false;
			hasLoaded = false;
			loadTimeOut = $timeOut;
			super();
		};
		
		//////////////////////////////////////////////////////////////////////
		// Start watching for changes in load behaviour
		//////////////////////////////////////////////////////////////////////
		protected function createLoader( $dataFormat:String = URLLoaderDataFormat.BINARY ):void 
		{
			loader = new URLLoader();
			loader.dataFormat = $dataFormat;	// set the dataformat type
			loader.addEventListener( IOErrorEvent.IO_ERROR, onDataIOError, false, 0, true );					// FAIL :(
			loader.addEventListener( SecurityErrorEvent.SECURITY_ERROR, onDataSecurityError, false, 0, true );	// FAIL
			loader.addEventListener( HTTPStatusEvent.HTTP_STATUS, onDataHttpStatus, false, 0, true );			// FAIL
			loader.addEventListener( ProgressEvent.PROGRESS, onDataLoadProgress, false, 0, true );
			loader.addEventListener( Event.OPEN, onDataLoadBegin, false, 0, true );
			loader.addEventListener( Event.COMPLETE, onDataLoadComplete, false, 0, true );		// SUCCESS!
			loadErrorInterval = setTimeout( onDataLoadTimeOut, loadTimeOut );					// FAIL TIME OUT
        };
		
		//////////////////////////////////////////////////////////////////////
		// End watching for load changes (Load has completed!)
		//////////////////////////////////////////////////////////////////////
        protected function removeListeners():void 
		{
			clearTimeout( loadErrorInterval );
			
			loader.removeEventListener( IOErrorEvent.IO_ERROR, onDataIOError );						// FAIL :(
			loader.removeEventListener( SecurityErrorEvent.SECURITY_ERROR, onDataSecurityError );	// FAIL
			loader.removeEventListener( HTTPStatusEvent.HTTP_STATUS, onDataHttpStatus );			// FAIL
			loader.removeEventListener( Event.OPEN, onDataLoadBegin );
			loader.removeEventListener( Event.COMPLETE, onDataLoadComplete );
			loader.removeEventListener( ProgressEvent.PROGRESS, onDataLoadProgress );
			
			loader.close();
			loader = null;
        };
		
		//////////////////////////////////////////////////////////////////////
		// PUBLIC : Load an file and dispatch an event when done
		//////////////////////////////////////////////////////////////////////
		public function load( $url:String, $crossDomain:Boolean=false, $timeOut:Number=DEFAULT_LOAD_TIMEOUT, $dataFormat:String=URLLoaderDataFormat.BINARY ):void 
		{
			if ($timeOut != DEFAULT_LOAD_TIMEOUT) loadTimeOut = $timeOut;						// update time out
			if (!isLoading) 
			{
				try {			
					var httpRequest:URLRequest = new URLRequest( $url );	// web request
					startRequested = true;														// update start
					hasLoaded = false;															// reset load
					createLoader( $dataFormat );												// start observing
					
					loader.load( httpRequest  );												// load the URL!				
					//onDataLoadBegin();														// trigger start event
				}catch ( $error:ArgumentError ){
					onDataLoadError( "ArgumentError:"+$error.message );							// premature error!
				} catch ( $error:SecurityError ){
					onDataLoadError( "SecurityError:"+$error.message );							// premature error! cross domain perhaps?
				}catch( $error:Error ){				
					onDataLoadError( $error.message );											// premature error! no internet connection?
				}
			} else {
				abortLoad();																	// cancel current load stream
			}
		};
		
		//////////////////////////////////////////////////////////////////////
		// PUBLIC : UNLoad the file in memory and free up some space
		//////////////////////////////////////////////////////////////////////
		public function unload( ):void 
		{
			if (loader) 
			{
				abortLoad();
				loader = null;
			}
			
		};

		/////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : Abort this load!!!!
		/////////////////////////////////////////////////////////////////////////////////
		public function abortLoad():void 
		{
			loader.close();
			removeListeners();
			hasLoaded = false;
			startRequested = false;
		};
		
		// EVENTS =======================================================================
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : LOAD REQUESTED
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataLoadBegin( $event:Event ):void
		{
			$event.stopImmediatePropagation();
			dispatchEvent( new LoadingEvents( LoadingEvents.BEGIN ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : LOADING...
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataLoadProgress( $event:ProgressEvent ):void
		{
			$event.stopImmediatePropagation();
			dispatchEvent( new LoadingEvents( LoadingEvents.PROGRESS, false, false, $event.bytesLoaded, $event.bytesTotal ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : SUCCESS
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataLoadComplete( $event:Event ):void
		{
			//var loader:URLLoader = event.target.loader as URLLoader
			//var vars:URLVariables = new URLVariables(loader.data);
			
			$event.stopImmediatePropagation();
			content = ( $event.target.data ) as Object;
			hasLoaded = true;
			
			onDataReady();
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : READY!
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataReady():void
		{
			removeListeners( );
			dispatchEvent( new LoadingEvents( LoadingEvents.COMPLETE ) );
			dispatchEvent( new AvailabilityEvent( AvailabilityEvent.AVAILABLE ) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : FAIL :(
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataLoadError( $errorMessage:String='FAIL' ):void 
		{
			var error:Error = new Error( $errorMessage );
			severStatus = $errorMessage;
			hasLoaded = false;
			
			removeListeners();
			dispatchEvent( new AvailabilityEvent( AvailabilityEvent.NOT_AVAILABLE ) );
			dispatchEvent( new FailEvent( error ) );
			trace("Problems accessing data on server [ " + $errorMessage + " ] " );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : SUCCESS / FAIL - UPDATE STATUS
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataHttpStatus( $event:HTTPStatusEvent ):void 
		{
			severStatus = String( $event.status );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : FAIL - Time Out occurred :(
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataLoadTimeOut():void
		{
			onDataLoadError( "Time out occurred after "+loadTimeOut );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : OTHER FAIL CASE > IO fail 
		// eg. cannot handshake, 402, 500...
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataIOError( $event:IOErrorEvent ):void 
		{
			onDataLoadError( $event.text );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// EVENT : OTHER FAIL CASES > Security Sandbox fail 
		// eg. lacking a crossdomain.xml, security policy not set
		/////////////////////////////////////////////////////////////////////////////////
		protected function onDataSecurityError( $event:SecurityErrorEvent ):void 
		{
			onDataLoadError( $event.text );
		};	
	}
}