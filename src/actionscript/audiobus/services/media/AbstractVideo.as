/*/////////////////////////////////////////////////////////////////////////

A base file for video formats in flash

Extend this file for each streaming datatype that you wish to create.

Supported File Types : MP4 / FLV / MOV / H264 / MovieStar

/////////////////////////////////////////////////////////////////////////*/
package audiobus.services.media 
{
	import audiobus.models.media.AudioModel;
	
	public class AbstractVideo extends AbstractStream 
	{
		
		public function AbstractVideo($audioModel:AudioModel) 
		{
			super($audioModel);
			
		}
		
		protected function onCuePoint():void
		{
			
		}
		
	}

}