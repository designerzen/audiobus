package audiobus.controllers.animation 
{
	import audiobus.controllers.animation.tweens.Tween;
	
	import flash.events.Event;
	import flash.events.TimerEvent;
	
	import flash.utils.getTimer;
	import flash.utils.Timer;
	
	public final class Animator 
	{
		static private const instance:Animator = new Animator();
		
		static public var headTween:Tween;
		
		// this is a linked list object pool that allows us to reuse old tweens easily :)
		static public const pool:Vector.<Tween> = new Vector.<Tween>( 50 );
		
		static private var quantityActive:int = 0;
		static private var quantityPooled:int = 0;
		
		// set / get speed of all tweens
		static public function set frameRate( $framesPerSecond:Number ):void
		{
			instance.timer.delay = 1000 / $framesPerSecond;
		}
		
		static public function overWriteOptions( $tween:Tween, $options:Object ):Tween
		{
			if ($options == null) return $tween;
			$tween.onEnd = $options.onEnd;
			$tween.onEndArgs = $options.onEndArgs;
			$tween.onFrame = $options.onFrame;
			$tween.onFrameArgs = $options.onFrameArgs;
			$tween.onBegin = $options.onBegin;
			$tween.onBeginArgs = $options.onBeginArgs;
			if ($options.equation) $tween.equation = $options.equation;
			return $tween;
		}
		
		static public function tween( $target:Object , $variable:String, $endAt:Number, $duration:Number=10, $startFrom:Number = NaN, $overWrite:Boolean = true, $options:Object=null ):Tween
		{
			if ($overWrite)
			{
				// check for current animation for overwrite
				var tween:Tween = checkExisting( $target, $variable );
				// *yay* a conflicting tween has been found! re-route :)
				if (tween)
				{
					if (tween.onEnd != null) tween.onEnd.apply( null, tween.onEndArgs );
					tween.position = 0;
					tween.startCondition = $startFrom;
					tween.endCondition = $endAt;
					tween.duration = $duration;
					tween.isActive = false;
					overWriteOptions( tween, $options );
					
					trace( "\nAnimator : Re-routing Tween end:"+$endAt + " start:"+$startFrom );
					// as this is already in memory, no need to add to Animator
					return tween;
				}
			}
			
			// check to see if there is a tween waiting for re-use in the pool
			if ( quantityPooled - quantityActive > 0 )
			{
				// yes there is!
				// try to fetch an old tween from the pool...
				tween = pool.shift();
				tween.position = 0;
				tween.duration = $duration;
				tween.startCondition = $startFrom;
				tween.endCondition = $endAt;
				tween.target = $target;
				tween.parameter = $variable;
				if ($options)
				{
					overWriteOptions( tween, $options );
				}else {
					tween.onBegin = null;
					tween.onEnd = null;
					tween.inPool = false;
				}
				
				//tween.isPrivate = false;
				quantityPooled--;
				//trace( "\nAnimator : Fetching "+tween+" from pool :"+quantityPooled );
			}else {
				// no pooled objects, so lets create one :)
				//trace( "\nAnimator : Creating new Tween as pool is empty :"+quantityPooled );
				tween = new Tween( $target, $variable, $endAt, $duration, $startFrom );
				overWriteOptions( tween, $options );
			}
			
			// loop through entire collection to see if already exists?
			Animator.add( tween );
			return tween;
		}
		
		/*
		static private function fetchFromPool():Tween 
		{
			var tween:Tween;
			// pop it out of the list...
			if ( poolHead.next )
			{
				// now see if it is the only one
				var subsequent:Tween = poolHead.next;
				tween = poolHead;
				poolHead = subsequent;
				subsequent.previous = null;
			}else {
				tween = poolHead;
				poolHead = null;
			}
			
			tween.inPool = false;
			quantityPooled--;
			return tween;
		}
		*/
		static private function checkExisting( $target:Object , $variable:String ):Tween
		{
			var tween:Tween = headTween;
			while ( tween )
			{
				// check to see if there is a parameter ease in memory
				if (( tween.target == $target ) && ( tween.parameter == $variable )) return tween;
				// switch in the next tween
				tween = tween.next;
			}
			return null;
		}
		
		static public function add( $tween:Tween ):Tween
		{
			if (headTween) 
			{
				headTween.previous = $tween;
				$tween.next = headTween;
				$tween.previous = null;
			}else {
				instance.timer.start();
			}
			quantityActive++;
			headTween = $tween;
			
			//trace("Animator : Added active:" + quantityActive + ". Pooled:" + quantityPooled + " data = "+ $tween );
			
			return headTween;
		}
		
		static public function remove( $tween:Tween ):void
		{
			
			// add to pool if not private
			if ( !$tween.isPrivate )
			{
				pool.unshift( $tween );
				quantityPooled++;
				$tween.inPool = true;
			}
			
			quantityActive--;
			//trace("Animator : "+$tween+" removed. Remaining active = "+quantityActive+" ============== " );
			
			
			if (headTween == $tween )
			{
				headTween = $tween.next;
				//if ( headTween ) headTween.previous = null;
			}
			
			// and unlink ourselves!
			$tween.unlink();
			
			/*
			var tween:Tween = headTween;
			while ( tween )
			{
				trace( "Still Active -> "+tween );
				tween = tween.next;		// switch in the next tween
				
			}
			*/
			// FIX HERE
			if ( quantityActive == 0 ) instance.onAnimationsCompleted();
		}
		
		private var timer:Timer;
		
		//////////////////////////////////////////////////////////////////////////////////////
		// Constructor
		//////////////////////////////////////////////////////////////////////////////////////
		public function Animator() 
		{
			// 17 is good for animations... should default to stage fps :)
			timer = new Timer( 17, 0 );
			timer.addEventListener( TimerEvent.TIMER, onUpdateFrames );
		}
		
		private function onUpdateFrames( $event:Event=null ):void
		{
			/*
			if (tween == null) 
			{
				timer.stop();
				return;
			}
			*/
			var time:int = getTimer();
			
			//trace('Animator : Animating '+quantityActive+' time:'+time );
			var tween:Tween = headTween;
			while ( tween )
			{
				tween.update( time );
				tween = tween.next;		// switch in the next tween
			}
		}
		
		// All animations have ended. 
		public function onAnimationsCompleted():void
		{
			headTween = null;
			//trace( "Animator : Animations completed ["+quantityActive+"]. Pooled instances = "+quantityPooled );
			//trace( "#########################################################################################" );
			timer.stop();
		}
	}

}

