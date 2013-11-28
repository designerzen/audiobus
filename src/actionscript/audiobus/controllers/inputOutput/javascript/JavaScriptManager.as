package audiobus.controllers.inputOutput.javascript 
{
	import flash.events.EventDispatcher;
	import flash.external.ExternalInterface;
	
	public class JavaScriptManager extends EventDispatcher 
	{
		public static var fatalError:Boolean = false;
		public static var errorMessages:Array = new Array();
		
		public static function get errors():Array
		{
			return errorMessages;
		}
		
		public static function get isAvailable():Boolean
		{
			return (fatalError) ? false : ExternalInterface.isAvailable;
		}
		
		/*
		public function JavaScriptManager() 
		{
			
		}
		*/
		
		public static function test( $isFirstCall:Boolean ) : Boolean 
		{
			var sandboxType:String = flash.system.Security['sandboxType'];
			if (!didSandboxMessage && sandboxType != 'localTrusted' && sandboxType != 'remote')
			{
				didSandboxMessage = true;
				errorMessages.push('<br><b>Fatal: Security sandbox error: Got "' + sandboxType + '", expected "remote" or "localTrusted".<br>Additional security permissions need to be granted.<br>See <a href="http://www.macromedia.com/support/documentation/en/flashplayer/help/settings_manager04.html">flash security settings panel</a> for non-HTTP, eg., file:// use.</b><br>http://www.macromedia.com/support/documentation/en/flashplayer/help/settings_manager04.html<br><br>You may also be able to right-click this movie and choose from the menu: <br>"Global Settings" -> "Advanced" tab -> "Trusted Location Settings"<br>');
			}
			
			try {
				
				if ( $isFirstCall ) 
				{
					errorMessages.push('Testing Flash -&gt; JS...');
					var d: Date = new Date();
					ExternalInterface.call(baseJSController + "._externalInterfaceOK", d.getTime(), version);
					errorMessages.push('Flash -&gt; JS OK');
				} else {
					errorMessages.push('SM2 SWF ' + version + ' ' + version_as);
					errorMessages.push('JS -> Flash OK');
					ExternalInterface.call(baseJSController + "._setSandboxType", sandboxType);
					errorMessages.push('JS to/from Flash OK');
				}
				
			} catch(e: Error) {
				errorMessages.push('Fatal: Flash &lt;-&gt; JS error: ' + e.toString());
				errorMessages.push('_externalInterfaceTest: Error: ' + e.toString());
				
				// As we have not already returned...
				fatalError = true;
				
				return false;
			}
			return true; // to verify that a call from JS to here, works. (eg. JS receives "true", thus OK.)
		}
	}

}