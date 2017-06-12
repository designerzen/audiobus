package audiobus.views.components.animation 
{
	import audiobus.views.components.AbstractComponent;
	import flash.display.Shape;
	import flash.events.Event;

	public class AnimationPreloader extends AbstractComponent 
	{
		private var slices:int;
		private var radius:int;
		private var rotationAngle:int;
		private var colour:uint;
		
		public function AnimationPreloader( $radius:int=40, $slices:int=7, $colour:uint=0xffffff ) 
		{
			colour = $colour;
			slices = $slices;
			radius = $radius;
			rotationAngle = 360 / slices;
			super();
			
		}
		override protected function added():void 
		{
			draw();
			addEventListener(Event.ENTER_FRAME, onEveryFrame );
		}
			
		override protected function removed():void 
		{
			removeEventListener(Event.ENTER_FRAME, onEveryFrame );
			super.removed();
		}
		
		private function draw():void
		{
			var i:int = slices;
			while (i--)
			{
				var slice:Shape = getSlice();
				slice.alpha = Math.max(0.2, 1 - (0.1 * i));
				var radianAngle:Number = (rotationAngle * i) * Math.PI / 180;
				slice.rotation = -rotationAngle * i;
				slice.x = Math.sin(radianAngle) * radius;
				slice.y = Math.cos(radianAngle) * radius;
				addChild(slice);
			}
			super.cacheAsBitmap = true;
			//super.cacheAsBitmapMatrix = transform.concatenatedMatrix;
		}
		
		// draw just one part of the loader
		private function getSlice():Shape
		{
			var slice:Shape = new Shape();
			slice.graphics.beginFill( colour );
			slice.graphics.drawRoundRect(-1, 0, 12, 16, 12, 12);
			slice.graphics.endFill();
			return slice;
		}
		
		private function onEveryFrame(e:Event):void 
		{
			// rotate shape
			super.rotation = (super.rotation + rotationAngle) % 360;
		}
	}

}