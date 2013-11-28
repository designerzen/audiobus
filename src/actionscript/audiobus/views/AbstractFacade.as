package audiobus.views 
{
	import flash.display.Sprite;
	import flash.events.Event;

	public class AbstractFacade extends Sprite 
	{
		
		public function AbstractFacade() 
		{
			if (stage) onAddedToStage();
			else addEventListener(Event.ADDED_TO_STAGE, onAddedToStage);
			
			super();
		}

		private function onAddedToStage( $event:Event = null ):void 
		{
			removeEventListener(Event.ADDED_TO_STAGE, onAddedToStage );
			// entry point
			initialise();
		}
		
		// Kick things off right here
		protected function initialise():void
		{
			
		}
		
	}

}