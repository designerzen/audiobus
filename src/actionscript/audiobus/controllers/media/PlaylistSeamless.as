package audiobus.controllers.media 
{
	import audiobus.controllers.animation.Animator;
	import audiobus.controllers.animation.tweens.Tween;
	import audiobus.models.events.BufferingEvent;
	import audiobus.models.events.PositionChangeEvents;
	import audiobus.services.media.IMediaControl;

	public class PlaylistSeamless extends Playlist 
	{
		private var lastUsedVolume:Number;
		private var preloading:IMediaControl;

		public function PlaylistSeamless($loadImmediately:Boolean=false, $playImmediately:Boolean=false, $stopOnError:Boolean=false) 
		{
			super($loadImmediately, $playImmediately, $stopOnError);
		}
		
		public function getNext():IMediaControl 
		{
			if ( index == mediaControlItems.length-1 )
			{
				// loop round back to zero
				if ( model.loops < 0 ) return mediaControlItems[ 0 ];
				// do not continue
				else return null;
			} else {
				// progress to next index
				return mediaControlItems[ index+1 ];
			}
		}
		override protected function onPositionChanged($event:PositionChangeEvents):void 
		{
			switch( $event.type )
			{
				case PositionChangeEvents.BEGIN:
					preloading = null;
					break;
					
				case PositionChangeEvents.CHANGE:
					// preload next if neccessary...
					if ( (currentItem.loadProgress == 1)&&(!preloading) )
					{
						//if ( $event.position > currentItem.po)
						preloading = getNext();
						if (preloading)
						{
							//preloading.cue();
						}
					}
					break;
					
				case PositionChangeEvents.COMPLETE:					
					break;
			}
			super.onPositionChanged($event);
		}
		
		override public function togglePause():void 
		{
			if (model.isPaused) resume();
			else pause();
		}
		
		override public function pause():void 
		{
			if (model.isPaused) return;
			model.isPaused = true;
			lastUsedVolume = super.volume;
			
			fadeOut( currentItem, currentItem.pause );
		}
		
		override public function resume():void 
		{
			if (!model.isPaused) return;
			model.isPaused = false;
			currentItem.volume = 0;
			
			currentItem.resume();
			fadeIn( null, super.volume );
			
		}
		
		override public function previous():IMediaControl 
		{
			// requires special handling :/
			// TODO: this should wait until the sound is beginning to play otherwise the loading time may 
			// nagate the fade duration :/
			return super.previous();
		}
		
		override public function start($startTime:Number = 0):void 
		{
			model.volume = super.volume;
			super.start($startTime);
			
		}
		
		override public function stop():void 
		{
			if ( currentItem.position >= currentItem.duration )
			{
				// too close to end to fade really...
				super.stop();
			}else {
				// if remaining is less than fade length
				lastUsedVolume = super.volume;
			
				
				
				//fadeOut( currentItem, currentItem.stop , 40, stopMonitoringItem, [currentItem] );
				fadeOut( currentItem, currentItem.stop , 40 );
				// TODO: Test!
				stopMonitoringItem( currentItem );
				// make sure to throw some events for buffering!
				if ( currentItem.isBuffering ) onBuffering( new BufferingEvent( BufferingEvent.BUFFERING_END ) );
				model.isPaused = true;
			}
		}
	
		
		private function fadeOut( $item:IMediaControl, $endMethod:Function, $duration:Number=40, $secondaryMethod:Function=null, $secondaryArgs:Array=null ):void
		{
			// ensure we don't fade beyond the remaining duration
			var remaining:Number = $item.duration - $item.position;
			var fadeDuration:Number = (remaining < $duration ) ? remaining : $duration ;

			Animator.tween( currentItem, "volume", 0, $duration, NaN, true, { onEnd:onFadeOutEnd, onEndArgs:[ currentItem, $endMethod, currentItem.position-$duration, $secondaryMethod, $secondaryArgs ] } );
		}

		private function onFadeOutEnd( $item:IMediaControl, $method:Function, $revertToPosition:Number =0 , $secondaryMethod:Function=null, $secondaryArgs:Array=null ):void
		{
			$method.apply( null );
			if ($secondaryMethod!=null) $secondaryMethod.apply( null, $secondaryArgs );
			$item.position = $revertToPosition;
			$item.volume = lastUsedVolume;
		}
		
		private function fadeIn( $endMethod:Function, $volume:Number, $duration:Number=40 ):void
		{
			currentItem.position -= $duration;
			Animator.tween( currentItem , "volume", $volume, $duration, NaN, true );
		}
		
	
	}

}