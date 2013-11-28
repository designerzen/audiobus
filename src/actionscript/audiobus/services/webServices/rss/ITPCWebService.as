package audiobus.services.webServices.rss 
{
	public class ITPCWebService extends RSSWebService 
	{
		
		public function ITPCWebService($timeOut:Number=DEFAULT_LOAD_TIMEOUT) 
		{
			super($timeOut);
			
		}
		
		/*
		override protected function onDataReady():void 
		{
			super.onDataReady();
		}
		*/
		
		override public function loadService($service:String, $crossDomain:Boolean = false, $timeOut:Number = DEFAULT_LOAD_TIMEOUT):void 
		{
			// here we strip off the itpc prefix and replace with http :)
			var url:String = $service.replace( /itpc:\/\// , "http://" )
			super.loadService(url, $crossDomain, $timeOut);
		}
	}

}