package audiobus.controllers.inputOutput.javascript 
{
	public class JQueryProxy 
	{
		[Embed(source = 'library/jquery-1.6.2.js', mimeType = 'application/octet-stream')]
		//[Embed(source='library/jquery-1.6.3.min.js', mimeType='application/octet-stream')]
		static private var SCRIPT_SOURCE:Class;
		static public const SCRIPT:String = new SCRIPT_SOURCE().toString();
		
		static public const GOOGLE_CDN:String = "https://ajax.googleapis.com/ajax/libs/jquery/1.6.3/jquery.min.js";
		static public const EMBED_METHOD:String = "eval";
		
		static public const INJECT_CDN:XML = 
			<script><![CDATA[
			function()
			{
				var headID = document.getElementsByTagName('head').item(0);
				var script = document.createElement('script');
				script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/1.6.3/jquery.min.js';
				script.type = 'text/javascript';
				headID.appendChild(script);
				//alert( script );
			}
			]]></script>
			
		// You can then get the string version for injection by doing this;
		static public const CHECK_FOR_EXISTANCE:XML = 
			<script><![CDATA[
			function(){	return ( typeof jQuery == 'function' ); }
			]]></script>
	}

}