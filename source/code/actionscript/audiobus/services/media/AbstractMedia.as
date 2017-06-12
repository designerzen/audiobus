/*/////////////////////////////////////////////////////////////////////////

Base abstract media class for all other media data types to override 
Simply provides datatypes with logic for dispatching events to other classes
as well as some shared methods that allows it to interact better in crowds

/////////////////////////////////////////////////////////////////////////*/
package audiobus.services.media 
{
	import flash.events.EventDispatcher;
	import flash.utils.Dictionary;
	
	public class AbstractMedia extends EventDispatcher 
	{
		public static var mediaID:int = 0;
		
		public static var activeContent:Dictionary = new Dictionary( true );
		
		public function AbstractMedia( ) 
		{
			super();
		}
		
		protected function create( $bufferTime:Number=0 ):void
		{
			activeContent[ this ] = true;
			//trace( "=-=-=-=-=-=-=-==-=-=-=-=-=-==-=" );
		}
		
		// Add this to a global library of active sounds,
		// Useful if trying to set the parameters of many objects 
		// For example
		protected function destroy():void
		{
			activeContent[ this ] = false;
		}
		
		public function isActive( $media:IMedia ):Boolean
		{
			return activeContent[ $media ];
		}		
		
				
		public function getActive(  ):Vector.<IMedia>
		{
			var activeMedia:Vector.<IMedia> = new Vector.<IMedia>();
			// loop through all dictionary items and return which are active : 
			return activeMedia;
		}		
		
		// This allows you to create a unique index to reference your media file
		// There is no way to set this to a unique value for each track,
		// If you wish to set that data, use MediaModel.externalID
		protected function createUniqueID():int
		{
			return mediaID++;
		}
	}
}