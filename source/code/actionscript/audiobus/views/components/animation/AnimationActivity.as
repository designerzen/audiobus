package audiobus.views.components.animation 
{
	import flash.events.Event;
	import views.AbstractView;

	public class AnimationActivity extends AbstractView 
	{
		private var diameter:Number;
		private var radius:Number;
		private var colours:Array;
		private var bands:Number = 3;
		private var rotationAngle:int = 3;
		private var currentAngle:int;

		public function AnimationActivity( $diameter:Number, $colours:Array ) 
		{
			diameter = $diameter;
			radius = diameter / 2;
			colours = $colours;
			super();
			//super.drawBackground( diameter, diameter, 0xff0000, 0.5, -radius, -radius );
		}
		
		override protected function added():void 
		{
			currentAngle = 0;
			draw();
			addEventListener(Event.ENTER_FRAME, onEveryFrame );
		}
		
			
		override protected function removed():void 
		{
			removeEventListener(Event.ENTER_FRAME, onEveryFrame );
			super.removed();
		}
		
		protected function draw( $hide:Boolean = false ):void 
		{
			var scale:int = radius / bands;
			var factor:Number = 0.1;
			for ( var c:int = 0; c < 2; ++c )
			{
				var colour:uint = colours[c+1];
				for ( var s:int = 1; s <= bands; ++s )
				{
					var bar:Bar;
					var thickness:Number = s * scale;
					if ( c == 0 ) bar = new Bar( colour, thickness, 0, thickness, diameter*factor , 0 );
					else bar = new Bar( colour, -thickness , 0, thickness, diameter*factor, 180 );
					
					if ( $hide ) bar.visible = false;
					addChild( bar );
				}
			}
			
			super.graphics.beginFill( colours[0], 1 );
			super.graphics.drawCircle( 0, 0, radius*0.15 );
			super.graphics.endFill();
			
			super.cacheAsBitmap = true;
			super.cacheAsBitmapMatrix = transform.concatenatedMatrix;
		}
		
		protected function onEveryFrame(e:Event):void 
		{
			// rotate shape
			if (currentAngle < rotationAngle ) currentAngle += 1;
			super.rotation = (super.rotation + currentAngle) % 360;
		}
	}

}


import flash.display.Shape;
import views.utils.draw.Arc;

internal class Bar extends Shape
{
	public function Bar( $colour:uint, $x:Number=0, $y:Number=0, $curveRadius:Number=2, $thickness:Number=30, $startAngle:Number=0 )
	{
		super.graphics.clear();
		//super.graphics.beginFill( $colour, 1 );
		super.graphics.lineStyle( $thickness, $colour, 1, false, "normal", null, null, 3 );
		Arc.draw( super.graphics, $x, $y, $curveRadius, 90, $startAngle, $curveRadius );
		//super.graphics.endFill();
	}
}