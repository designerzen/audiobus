package audiobus.models.media 
{
	import audiobus.models.Model;

	public class BandwidthModel extends Model 
	{
		private static var bandwidthInBytesPerMilliSecond:Number = 0;
		private static const PROFILES:Array = new Array();
		
		private static var currentProfile:Profile;
		
		// Return the value of the bandwidth in milliseconds
		public static function get bandwidth():Number
		{
			return bandwidthInBytesPerMilliSecond;
		}
		
		// Add a measurement to the queue
		public static function addMeasurement( $bandwidth:Number ):void
		{
			var quantity:int = PROFILES.push( $bandwidth );
			var accumulatedBandwidth:Number = 0;
			for ( var p:Number in PROFILES ) accumulatedBandwidth += p; 
			bandwidthInBytesPerMilliSecond = accumulatedBandwidth / quantity;
		}
		
		// Add a new profile to the list
		public static function addProfile( $bytesLoaded:Number, $timeTaken:Number ):void
		{
			var profile:Profile = new Profile( $bytesLoaded, $timeTaken );
			addMeasurement( profile.bandwidth );
		}
		
		// Start Profiling a new instance!
		public static function start():void
		{
			if (currentProfile) throw ArgumentError( "You need to call Stop() before commencing a new profile" );
			currentProfile = new Profile();
			currentProfile.start();
		}

		public static function stop( $bytesLoaded:Number ):void
		{
			if ( currentProfile == null ) throw ArgumentError( "You need to Start() the profile before calling Stop()" );
			currentProfile.stop( $bytesLoaded );
			addMeasurement( currentProfile.bandwidth );
			currentProfile = null;
		}
		
		public function BandwidthModel() { super(); }
	}
}


import flash.utils.getTimer;

internal class Profile
{
	private var startTime:int;
	private var endTime:int;
	private var duration:int;
	private var bytesLoaded:Number;
	
	// Fetch the bandwidth in Bytes / Millisecond
	public function get bandwidth():Number
	{
		return bytesLoaded / duration;
	}
	
	// Start profiling this instance of the tool
	public function start():void
	{
		duration = bytesLoaded = 0;
		startTime = endTime = getTimer();
	}
	
	// Stop profiling
	public function stop( $bytesLoaded:Number ):void
	{
		bytesLoaded = $bytesLoaded;
		endTime = getTimer();
		duration = endTime - startTime;
	}
	
	// Construct
	public function Profile( $bytesLoaded:Number=0, $timeTaken:Number=0 )
	{
		bytesLoaded = $bytesLoaded;
		duration = $timeTaken;
	}
}