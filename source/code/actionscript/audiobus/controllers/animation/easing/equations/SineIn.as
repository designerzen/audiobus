package audiobus.controllers.animation.easing.equations 
{

	public class SineIn 
	{
		// Ease
		// t:current time
		// b:start value
		// c:change in value
		// d:duration
		static public function Ease( $time:Number, $startValue:Number, $change:Number, $duration:Number):Number 
		{
			return -$change * Math.cos( $time / $duration * (Math.PI / 2)) + $change + $startValue;
        }

	}

}