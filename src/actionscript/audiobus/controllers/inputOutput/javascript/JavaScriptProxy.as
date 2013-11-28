package audiobus.controllers.inputOutput.javascript 
{
	import flash.events.Event;
	import flash.events.EventDispatcher;
	import flash.external.ExternalInterface;	
	
	public class JavaScriptProxy extends EventDispatcher
	{
		private static var swfLoadCompleteMethodCalled:Boolean = false;
		
		// event names
		private static const ON_JAVASCRIPT_ENABLED:String = "onJavascriptEnabled"; 
		private static const ON_JAVASCRIPT_DISABLED:String = "onJavascriptDisabled"; 
		
		// javascript methods
		private static const JS_FUNCTION_ON_SWF_LOADED:String = "onFlashLoaded";	
		
		private var isEnabled:Boolean = false;
		
		public function get enabled():Boolean
		{
			return isEnabled;
		}
	
		/////////////////////////////////////////////////////////////////////////////////////////////
		// Attempt to read the Object ID from the DOM element
		/////////////////////////////////////////////////////////////////////////////////////////////
		public function get objectID():String 
		{
			return ExternalInterface.objectID;
		}
		
		/////////////////////////////////////////////////////////////////////////////////
		// Constructor - do basic tests and send complete event to JS!
		/////////////////////////////////////////////////////////////////////////////////
		public function JavaScriptProxy( $dispatchEvents:Boolean = false, $testImmediately:Boolean=false, $onReadyMethodName:String=JS_FUNCTION_ON_SWF_LOADED ) 
		{
			if ( $testImmediately ) test();
		};
		
		
		public function test():void
		{
			if ( ExternalInterface.available ) onJSGatewayAvailable();
			else onJSGatewayUnavailable();
		};
		
		////////////////////////////////////////////////////////////////////////////
		// PUBLIC : 
		// *** JavaScript Gateway Proxy functions here ***
		// call a JS > function! ('func', 'args')
		////////////////////////////////////////////////////////////////////////////
		public function addCallback( JSMethodName:String, callback:Function ):Boolean
		{
			try {
				ExternalInterface.addCallback( JSMethodName, callback );
				return true;
			} catch (error:SecurityError) {
				onJSGatewayUnavailable("A JavaScript SecurityError occurred: " + error.message + "\n");
			} catch (error:Error) {
				onJSGatewayUnavailable("JavaScript Error : " + error.message + "\n");
			};
			return false;
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : 
		// UNI-Directional Javascript Call (will disregard any return vars!)
		// Useful for void methods in JS where multi-threading them speeds up Flash
		// Thanks : http://www.calypso88.com/?p=25
		/////////////////////////////////////////////////////////////////////////////////
		public function shout( JSMethodName:String, ...args:Array ):void
		{
			if ( !isEnabled ) return;
			var JSCall:String = JSMethodName + '(' + convertToQuotes(args) + ')';
			ExternalInterface.call('setTimeout', JSCall, 0);				//  IN JS : setTimeout(myJSFunction('foo'), 0);
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		// PUBLIC : 
		// BI-Directional Javascript Call (will proxy all return types)
		/////////////////////////////////////////////////////////////////////////////////
		public function converse( JSMethodName:String, ...args:Array ):*
		{
			try {
				return ExternalInterface.call( JSMethodName, args );
			}catch ( $error:Error ) {
				return null;
			}
		};
		
		////////////////////////////////////////////////////////////////////////////
		// PUBLIC : 
		// convert an array into a sequence of "" comma delimeted arguments!
		////////////////////////////////////////////////////////////////////////////
		public static function convertToQuotes( $args:Array, $startString:String="" ):String
		{
			for each(var a:String in $args) $startString += "'" + a + "',";
			return $startString.substr(0, $startString.length - 2) + "'";
		};
	
		/////////////////////////////////////////////////////////////////////////////////
		// *** JS > *** : Tell our JS script that we are ready to receive events!
		/////////////////////////////////////////////////////////////////////////////////
		protected function onJSGatewayAvailable():void
		{
			isEnabled = true;
			onSWFLoaded();
			dispatchEvent( new Event(ON_JAVASCRIPT_ENABLED) );
		};
		
		/////////////////////////////////////////////////////////////////////////////////
		//
		/////////////////////////////////////////////////////////////////////////////////
		protected function onJSGatewayUnavailable( message:String='JavaScript Gateway Failure \n' ):void
		{
			isEnabled = false;
			dispatchEvent( new Event(ON_JAVASCRIPT_DISABLED) );
			//throw Error("Javascript is not available, have you enable the embed paramater allowScriptAccess=always");
		}; 
		
		////////////////////////////////////////////////////////////////////////////
		// SWF has loaded into DOM, pass JS call now
		////////////////////////////////////////////////////////////////////////////
		protected function onSWFLoaded():void
		{
			if ( swfLoadCompleteMethodCalled ) return;
			else swfLoadCompleteMethodCalled = true;
			// try to call the JS method that tells the DOM that the swf is ready
			converse( JS_FUNCTION_ON_SWF_LOADED );
		};
	}

}
