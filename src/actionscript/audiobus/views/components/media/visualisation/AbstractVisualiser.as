package audiobus.views.components.media.visualisation 
{
	import audiobus.models.structure.ILinkedList;
	import flash.display.BitmapData;
	
	public class AbstractVisualiser extends BitmapData implements ILinkedList 
	{
		private var previousVisualiser:ILinkedList;
		private var nextVisualiser:ILinkedList;
		
		public function get isHead():Boolean
		{
			return ( previousVisualiser == null );
		}
		public function get isTail():Boolean
		{
			return ( nextVisualiser == null );
		}
		public function AbstractVisualiser( $width:int, $height:int, $transparent:Boolean=true, $fillColor:uint=4294967295) 
		{
			super( $width, $height, $transparent, $fillColor);
			
		}

		public function link( $previous:ILinkedList=null, $next:ILinkedList=null ):ILinkedList 
		{
			previousVisualiser = $previous;
			nextVisualiser = $next;
			return this;
		}
		
		public function unlink():ILinkedList 
		{
			nextVisualiser.previous = previousVisualiser;
			previousVisualiser.next = nextVisualiser;
			return this;
		}
		
		public function get previous():ILinkedList 
		{
			return previousVisualiser;
		}
		
	}

}