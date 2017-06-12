/*/////////////////////////////////////////////////////////////////////////

Very simple MP3 data type :D

/////////////////////////////////////////////////////////////////////////*/
package audiobus.services.media 
{
	import audiobus.models.media.AudioModel;
	
	public final class MP3 extends AbstractAudioFile 
	{
		public function MP3( $audioModel:AudioModel=null, $checkPolicyFile:Boolean=false, $loadImmediately:Boolean = false ) 
		{
			super( $audioModel );
		}
		
	}
}