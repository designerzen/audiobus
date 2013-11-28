package audiobus.services.webServices.rss 
{
	import audiobus.controllers.load.AbstractWebService;
	import audiobus.services.webServices.XMLWebService;
	import flash.events.Event;
	
	public class RSSWebService extends XMLWebService 
	{
		public var items:Array = new Array();
		
		public var title:String;
		
		public function RSSWebService($timeOut:Number=DEFAULT_LOAD_TIMEOUT) 
		{
			super( true, true );
		}
		
		override public function loadService($service:String, $crossDomain:Boolean = false, $timeOut:Number = AbstractWebService.DEFAULT_LOAD_TIMEOUT):void 
		{
			super.loadService($service, $crossDomain, $timeOut);
		}
		
		
		override protected function onDataLoadComplete($event:Event):void 
		{
			super.onDataLoadComplete($event);
		
			/*
			// scrape mp3s and create models
			var itemList:XMLList = super.xml.item;
			var media:Namespace = super.xml.namespace("media");
			
			for each (var item:XML in itemList)
			{
				trace(item.media::content.@url);
			}*/
		}
	}

}