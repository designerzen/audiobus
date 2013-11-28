package audiobus.services.webServices 
{
	import flash.events.IEventDispatcher;

	public interface IWebService extends IEventDispatcher
	{
		function get type():String;
		function get data():*;
		function loadService( $url:String, $crossDomain:Boolean = false, $timeOut:Number = 3000 ):void;
	}
	
}