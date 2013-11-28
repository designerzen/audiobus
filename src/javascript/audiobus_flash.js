(function(window) 
{
/*/======----- BEGIN -----=======/*/

// Set up public variables 
FlashAudioBus.prototype.isLoaded = false;


// Set up static variables
FlashAudioBus.playback = false;

// Set up private variables
var _swf, _ready = false;
	
var _model =
{
	url:'',
	bufferTime:3,
	bufferTimeMax:0,
	volume:1
}

// Constructor
function FlashAudioBus( id , model, nameSpace ) 
{
	
	_swf = getFlashMovie( id );
	_model = model;

	// check for errors
	console.log( "Using Flash Audio with : "+_model+" SWF : "+_swf + " on #ID : "+id );
	
	/*//////////////////////////////////////////////////////////////
	Read the spectrum data directly from the flash applet
	//////////////////////////////////////////////////////////////*/
	this.fetchSpectrum = function ( callback )
	{
		var eq = _swf.fetchSpectrum( callback );
		return eq.split( ',' );
	}
};

function getFlashMovie(movieName)
{
	var isIE = navigator.appName.indexOf("Microsoft") != -1;
	return (isIE) ? window[movieName] : document[movieName];
};

function create()
{
	
};

function destroy()
{
};




FlashAudioBus.prototype.volume = function ( vol )
{
	
};

FlashAudioBus.prototype.onFlashReady = function()
{
	console.log( "FLASH : READY TO DISPATCH!"+_swf );
	FlashAudioBus.prototype.isLoaded = true;
	_swf.debug( "SENDING TO SWF FROM JS ========================>" );
};

/*
FlashAudioBus.prototype.onEQData = function( dataSet )
{
	console.log( "EQ Data Received : "+dataSet );
};
*/
FlashAudioBus.prototype.onEQDataAvailability = function( available )
{
	console.log( "EQ Data has changed availability to : "+available );
};

FlashAudioBus.prototype.onTrackLoading = function( eventType )
{
	//console.log( "FLASH : TRACK Loading "+eventType );
};

FlashAudioBus.prototype.onTrackProgress = function( eventType )
{
	//console.log( "FLASH : TRACK Progress "+eventType );
};

FlashAudioBus.prototype.onBuffering = function( trueOrFalse )
{
	console.log( "FLASH : is Buffering ? "+trueOrFalse );
};

FlashAudioBus.prototype.onTrackFailed = function( eventType )
{
	console.log( "FLASH : TRACK FAILED! "+eventType );
};
// Expose to global scope
// Override self executing anonymous function by binding
// The anonymous method to the window object for reading externally
window.FlashAudioBus = FlashAudioBus;

/* self executing anonymous function */
} (window) );