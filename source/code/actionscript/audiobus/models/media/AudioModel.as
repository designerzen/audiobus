/*/////////////////////////////////////////////////////////////////////////

This is a parent class of the super class MediaModel that handles some more
Audio specific data such as waveforms, loops and EQ

/////////////////////////////////////////////////////////////////////////*/
package audiobus.models.media 
{
	public class AudioModel extends MediaModel 
	{
		public var leftPeak:Number = 0;		// Current Left Amplitude Peak
		public var rightPeak:Number = 0;	// Current Right Amplitude Peak
		
		// public var waveformData:Array = null;
		// public var eqData:Array = null;

		public function AudioModel( $loadImmediately:Boolean = false, $playImmediately:Boolean = false ) 
		{
			super( $loadImmediately, $playImmediately );
		}
		
	}

}