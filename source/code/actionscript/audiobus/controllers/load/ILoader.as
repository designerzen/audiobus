package audiobus.controllers.load 
{
	import flash.net.URLLoaderDataFormat;
	public interface ILoader 
	{
		// Is this loader actually active?
		function get isLoading():Boolean;
		
		// Has this loader completed?
		function get isLoaded():Boolean;
		
		// How many bytes have been downloaded from the URL?
		function get bytesLoaded():Number;
		
		// How many bytes are we expecting in full for the URL?
		function get bytesTotal():Number;
		
		// What percentage has downloaded?
		function get progress():Number;
		
		// Server message
		function get status():String;
		
		// Load an file and dispatch an event when done
		function load( $url:String, $crossDomain:Boolean=false, $timeOut:Number=3000, $dataFormat:String=URLLoaderDataFormat.BINARY ):void 
		
		// UNLoad the file in memory and free up some space
		function unload():void;

		// Abort this load!!!!
		function abortLoad():void;
	}
	
}