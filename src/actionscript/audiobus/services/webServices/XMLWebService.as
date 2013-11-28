package audiobus.services.webServices 
{
	import audiobus.controllers.load.AbstractWebService;
	import flash.net.URLLoaderDataFormat;
	
	public class XMLWebService extends AbstractWebService implements IWebService
	{
		public function get xml():XML
		{
			return XML( super.content );
		}
		
		public function XMLWebService( $ignoreWhitespaac:Boolean = true, $ignoreComments:Boolean=true ) 
		{
			XML.ignoreWhitespace = $ignoreWhitespaac;
			XML.ignoreComments = $ignoreComments;
			super();
		}
		
		public function loadService( $service:String, $crossDomain:Boolean = false, $timeOut:Number = AbstractWebService.DEFAULT_LOAD_TIMEOUT ):void 
		{
			super.load( $service, $crossDomain, $timeOut, URLLoaderDataFormat.BINARY );
		}
		
		/*
		override protected function onDataReady():void 
		{
			super.onDataReady();
		}
		*/
	}

}