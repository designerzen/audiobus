package audiobus.controllers.animation.tweens 
{

	public class ParticleTween extends Tween 
	{
		public var acceleration:Number = 0.0001;
		public var friction:Number = 1;
		
		public function ParticleTween($target:Object, $variable:String, $endAt:Number, $duration:Number=10, $startFrom:Number=NaN, $delay:Number=0 ) 
		{
			super($target, $variable, $endAt, $duration, $startFrom, $delay );
		}
		
		override public function update($time:int):void 
		{
			var current:Number = target[ parameter ];
			
			
			// distance
			
			// position
			
			if ( super.isActive == false ) super.begin();

			//trace( time + "/"+duration + ". TWEEN : Update by "+change+" to "+ result );
			// apply acceleration in c
			target[ parameter ] = 2*target[ parameter ] - position + acceleration;
			
			position = current;
			
			// call the update on frame method
			if ( onFrame != null ) onFrame.apply( null, onFrameArgs );
			
			// check to see if we have reached our destination
			if ( endAt > startFrom ) if ( target[ parameter ] >= endAt ) end();
			if ( endAt < startFrom ) if ( target[ parameter ] <= endAt ) end();
		}
		
	}

}