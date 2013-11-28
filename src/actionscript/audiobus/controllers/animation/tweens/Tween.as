package audiobus.controllers.animation.tweens 
{
	import audiobus.controllers.animation.Animator;
	import audiobus.controllers.animation.easing.equations.SineIn;
	
	public class Tween implements ITween
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
		
		public var target:*;						// object to tween
		public var equation:Function = SineIn.Ease;		// ease equation
		public var parameter:String;					// parameter on target to tween
		
		// private vars
		protected var startFrom:Number;
		protected var endAt:Number;
		protected var distance:Number;
		
		public var position:Number;
		public var duration:Number;
		public var delay:Number;
		
		public var isPrivate:Boolean = false;
		public var inPool:Boolean = false;
		public var isActive:Boolean = false;
		
		public function set startCondition( $startFrom:Number ):void
		{
			startFrom = ( isNaN($startFrom) ) ? target[ parameter ] : $startFrom;
		}
		
		public function set endCondition( $endAt:Number ):void
		{
			endAt = $endAt;
			
			// if negative, react differently?
			if ( $endAt > startFrom ) distance = startFrom + (endAt - startFrom);
			else distance = endAt - startFrom;
			
			trace( "\n" + "== startFrom:" + startFrom + " , endAt:" + endAt + " , distance:" + distance + "\n");
		}
		
		public function Tween( $target:* , $variable:String, $endAt:Number, $duration:Number=10, $startFrom:Number = NaN, $delay:Number=0, $equation:Function = null ) 
		{
			if ( $equation != null ) equation = $equation;
			parameter = $variable;
			target = $target;
			this.startCondition = $startFrom;
			this.endCondition = $endAt;
			duration = $duration;
			delay = $delay;
			position = 0;
			//trace( "TWEEN : ============== FROM : "+$startFrom+" ======= TO : "+$endAt+" === DIFF : "+distance );
			//trace( "TWEEN : ="+ target+"= FROM : "+target[ parameter ]  );
			//trace( "TWEEN : ============== FROM : "+startFrom+" ======= TO : "+endAt+" === DIFF : "+distance );
		}

		// START :
		public function start():void
		{
			if (isActive) return;
			begin( true );
			Animator.add( this );
		}
		
		// BEGIN
		protected function begin( $isPrivate:Boolean=false ):void
		{
			isPrivate = $isPrivate;
			
			// if it has not been called by Animation Factory, add it?
			if (onBegin != null) onBegin.apply( null, onBeginArgs );
			isActive = true;
			target[ parameter ] = startFrom;
			
			//trace( "TWEEN : Start ============== FROM : "+startFrom+" ======= TO : "+endAt );
		}
		
		// UPDATE ANIMATION : Ease here
		public function update( $time:int ):void
		{
			// set parameter
			var result:Number = equation( position++, startFrom, distance, duration );
			
			if ( !isActive ) begin();
			
			trace( int( 100 * position / duration ) + "%. TWEEN ["/*+target*/+"] from:"+startFrom+" diff:"+distance+" to:"+ result );
			target[ parameter ] = result;
			
			// call the update on frame method
			if ( onFrame != null ) onFrame.apply( null, onFrameArgs );
			
			if ( position >= duration ) end();
		}	
		
		// END ANIMATION
		public function end( $remove:Boolean = true ):void 
		{
			target[ parameter ] = endAt;
			
			if (onEnd != null) onEnd.apply( null, onEndArgs );
			isActive = false;
			//trace( "TWEEN : End at "+ target[ parameter ] );
			
			// only if not "private"
			if ($remove) Animator.remove( this );
		}
		
		public function toString():String
		{
			var output:String = "Tween:";
			output += target + ' ';
			output += 'previous:' + (previous!=null) + ' next:' + (next!=null) + ', ';
			output += 'Active=' + isActive + ', ';
			output += 'Pooled=' + inPool + ', ';
			output += 'Private=' + isPrivate + ', ';
			//output += 'Start=' + startFrom + ', ';
			//output += 'End=' + endAt + ', ';
			//output += 'Duration=' + duration + ', ';
			//output += 'Time=' + position + ', ';
			//output += 'Delay=' + delay + ', ';
			output += 'onEnd=' + onEnd + ' args : ' + onEndArgs + ', ';
			return "["+output+"]";
		}
		
		public function unlink():void 
		{
			
			var previousTween:Tween = previous;
			var subsequentTween:Tween = next;
			if (subsequentTween) subsequentTween.previous = previous;
			if (previousTween) previousTween.next = next;
			
			previous = next = null;
		}
	}

}