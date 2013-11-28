package audiobus.controllers.animation.tweens 
{
	import controllers.animation.Animator;
	/**
	 * ...
	 * @author zen
	 */
	public class Particle implements ITween 
	{
		// call backs
		public var onBegin:Function;
		public var onFrame:Function;
		public var onEnd:Function;		
		
		// call back arguments
		public var onBeginArgs:Array;
		public var onFrameArgs:Array;
		public var onEndArgs:Array;
		
		// linked lists
		public var previous:Tween;
		public var next:Tween;
		
		private var startFrom:Number;
		private var endAt:Number;
		private var current:Number;
		private var isActive:Boolean = false;
		
		public var acceleration:Number = 1;
		public var friction:Number = 1;
		
		public var isPrivate:Boolean = false;
		public var inPool:Boolean = false;
		
		public function set startCondition($startFrom:Number):void 
		{
			startFrom = ( isNaN($startFrom) ) ? target[ parameter ] : $startFrom;
		}
		
		public function set endCondition(value:Number):void 
		{
			endAt = value;
		}
		
		public function Particle($target:Object , $variable:String, $endAt:Number, $duration:Number=10, $startFrom:Number = NaN, $delay:Number=0) 
		{
			parameter = $variable;
			target = $target;
			this.startCondition = $startFrom;
			endAt = $endAt;
			delay = $delay;
		}
		
		public function start():void 
		{
			begin( true );
			Animator.add( this );
		}		

		private function begin( $isPrivate:Boolean=false ):void
		{
			isPrivate = $isPrivate;
			
			// if it has not been called by Animation Factory, add it?
			if (onBegin != null) onBegin.apply( null, onBeginArgs );
			isActive = true;
			//trace( "TWEEN : Start ============== FROM : "+startFrom+" ======= TO : "+endAt );
		}
		
		public function update($time:int):void 
		{
			if ( current = endAt ) end();
		}

		public function end():void 
		{
			isActive = false;
		}
	}

}