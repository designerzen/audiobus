package audiobus.views.mediators 
{
	import audiobus.models.style.CSS;
	import audiobus.services.media.IMediaControl;
	import audiobus.views.components.animation.AnimationPreloader;
	import audiobus.views.components.text.TextBlock;
	import flash.utils.ByteArray;
	
	public class MediaPlayer extends AbstractMediator
	{
		[Embed(source = "../../../../bin/css/style.css", mimeType = "application/octet-stream")]
		private const CascadingStyleSheet:Class;
		
		private var loadingAnimation:AnimationPreloader;
		private var playingAnimation:AnimationPreloader;
		
		private var textField:TextBlock;
		private var media:IMediaControl;
		
		public function set position( $position:Number ):void 
		{
			playingAnimation.y = visibleHeight * $position;
			textField.text = "<h1>"+int($position*100)+"%</h1>";
		}
		
		public function set volume( $volume:Number ):void 
		{
			
		}
		
		public function onComplete( ):void 
		{
			playingAnimation.y = visibleHeight + playingAnimation.height;
			textField.text = "<h1>ITEM COMPLETE/h1>";
		}
		
		public function set item( $media:IMediaControl ):void 
		{
			media = $media;
		}
		
		public function MediaPlayer( $width:Number, $height:Number ) 
		{
			super( $width, $height );	
		}
		
		override protected function added():void 
		{
			var byteArray:ByteArray = new CascadingStyleSheet() as ByteArray;
			// read the content
			var stylesString:String = byteArray.readUTFBytes(byteArray.length);
			// parse the string by the stylesheet and done!
	
			var css:CSS = new CSS();
			css.parseCSS( stylesString );
			
			textField = new TextBlock( "Loading", visibleWidth, 24, 0x9999cc, 12, 12, false, "_sans", css );
			
			loadingAnimation = new AnimationPreloader( 20, 9, 0xee0000 );
			loadingAnimation.x = visibleWidth * 0.33;
			loadingAnimation.y = visibleHeight * 0.5;
			
			playingAnimation = new AnimationPreloader( 20, 7, 0x00ee00 );
			playingAnimation.x = visibleWidth * 0.66;
			playingAnimation.y = visibleHeight * 0.5;
			
			addChild( playingAnimation );
			addChild( textField );
		}
		
		override protected function removed():void 
		{
			super.removed();
			loadingAnimation = null;
		}
		
		public function showLoader():void
		{
			addChild( loadingAnimation );
		}
		
		public function hideLoader():void
		{
			removeChild( loadingAnimation );
		}
		
		
	}

}