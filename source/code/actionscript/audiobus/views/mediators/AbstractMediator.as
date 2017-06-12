package audiobus.views.mediators 
{
	import flash.display.Sprite;
	import flash.events.Event;
	
	public class AbstractMediator extends Sprite 
	{
		protected var visibleWidth:Number;
		protected var visibleHeight:Number;
		
		public function AbstractMediator( $width:Number, $height:Number )
		{
			visibleWidth = $width;
			visibleHeight = $height;
			
			if (stage) onAddedToStage(null);
			else addEventListener(Event.ADDED_TO_STAGE, onAddedToStage);
			
			super();
		}

		private function onAddedToStage(e:Event):void 
		{
			removeEventListener(Event.ADDED_TO_STAGE, onAddedToStage);
			addEventListener( Event.REMOVED_FROM_STAGE, onRemovedFromStage );
			added();
		}
		
		private function onRemovedFromStage(e:Event):void 
		{
			removeEventListener(Event.REMOVED_FROM_STAGE, onRemovedFromStage );
			addEventListener( Event.ADDED_TO_STAGE, onAddedToStage );
			removed();
		}
		
		protected function added():void {};
		protected function removed():void 
		{
			while ( this.numChildren > 0 ) removeChildAt( 0 );
		};
		
	}

}