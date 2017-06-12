/*/////////////////////////////////////////////////////////////////////////

A simple proxy for fetching waveform and EQ data for all types

/////////////////////////////////////////////////////////////////////////*/
package audiobus.controllers.media 
{
	import flash.media.SoundMixer;
	import flash.utils.ByteArray;
	
	public class SpectrumAnalyser
	{
		/*
		public static const CHANNEL_LEFT:String 	= "left";
		public static const CHANNEL_RIGHT:String 	= "right";
		public static const CHANNEL_MONO:String 	= "mono";
		*/
		
		// Containers for the byte codes read from compute spectrum
		private static const waveFormData:ByteArray = new ByteArray();
		//private static const EQFormData:ByteArray = new ByteArray();
		
		// Vectors containing normalised values ready for reading
		private static var waveFormVector:Vector.<Number> = new Vector.<Number>( 512, true );	// 512 Channels deep & fixed
		private static var EQFormVector:Vector.<Number> = new Vector.<Number>( 512, true );		// 512 Channels deep & fixed
		
		// Strings useful for passing data through to javascript seperated by | Pipes |
		public static var waveFormStringLeft:String 	= '';
		public static var waveFormStringRight:String 	= '';
		
		public static var EQFormStringLeft:String 		= '';
		public static var EQFormStringRight:String 		= '';
		
		private static var stretchFactor:Number = 0;
		private static var interpolation:Number = 1;
		private static var toMono:Boolean = false;
		
		/////////////////////////////////////////////////////////////////////////////////////
		// If you set the resolution value to 0, data is sampled at 44.1 KHz; 
		// with a value of 1, data is sampled at 22.05 KHz
		// with a value of 2, data is sampled 11.025 KHz etc.
		/////////////////////////////////////////////////////////////////////////////////////
		public static function set resolution( $resolution:Number ):void
		{
			stretchFactor = $resolution;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// Sample Resolution ( 1,2,3,4 etc)
		/////////////////////////////////////////////////////////////////////////////////////
		public static function get resolution():Number
		{
			return stretchFactor;
		};
		/*
		public static function set mono( $mono:Boolean ):void
		{
			toMono = $mono;
		};		
		*/
		
		public static function get isAvailable():Boolean 
		{
			return !SoundMixer.areSoundsInaccessible();
		};
		// End
		
		/////////////////////////////////////////////////////////////////////////////////////
		// FFT is set to OFF : Time Domain
		/////////////////////////////////////////////////////////////////////////////////////
		public static function get waveForm():Vector.<Number>
		{
			waveFormVector = computeSpectrum( false );
			return waveFormVector;
		};
		
		/////////////////////////////////////////////////////////////////////////////////////
		// FFT is set to ON : Frequency Domain
		/////////////////////////////////////////////////////////////////////////////////////
		public static function get spectrum():Vector.<Number>
		{
			EQFormVector = computeSpectrum( true );
			return EQFormVector;
		};
		
		// End of Spectrum Analyser
		public static function computeSpectrum( $fft:Boolean, $magnification:Number=1000 ):Vector.<Number>
		{
			var channelByte:Number;
			const microfication:Number = 1/$magnification;
			// reset store
			waveFormStringLeft = waveFormStringRight = '';
			// fetch data
			var accessible:Boolean = !SoundMixer.areSoundsInaccessible();
			
			if (accessible)
			{
				try 
				{
					SoundMixer.computeSpectrum( waveFormData, false, stretchFactor );
				} catch (e:SecurityError) {
					accessible = false;
				}
			}
			
			if (accessible)
			{
				// parse data
				for ( var i: int = 0; i < 512; i+=interpolation )
				{ 
					// get all 512 values (256 per channel)
					channelByte = int( waveFormData.readFloat() * $magnification ) / $magnification ;
					// save in JS friendly formats
					if (i < 256) waveFormStringLeft += channelByte + "|";	// Left Channel
					else waveFormStringRight += channelByte + "|";			// Right Channel
					// store values in super fast vector for returning back to AS
					waveFormVector[i] = channelByte;
				}
			}else{
				// Unable to access data, create zero based data instead
				for ( var r: int = 0; r < 512; r+=interpolation )
				{ 
					// save in JS friendly formats
					if (r < 256) waveFormStringLeft += "0|";	// Left Channel
					else waveFormStringRight += "0|";			// Right Channel
					waveFormVector[r] = 0;						// store values in super fast vector for returning back to AS
				}
			}
			return waveFormVector;
		};
		
	}

}