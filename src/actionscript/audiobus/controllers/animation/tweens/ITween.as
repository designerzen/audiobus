package audiobus.controllers.animation.tweens 
{
	public interface ITween 
	{
		function set startCondition( $startFrom:Number ):void;
		function set endCondition( $endAt:Number ):void;
		
		function update( $time:int ):void;
		function start():void;
		function end( $remove:Boolean = true ):void;
	}
	
}