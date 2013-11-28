/*

This is the standard html5 browser player. It follows the same interface as 
the flash version.

function init()
{
	registerCanvas( 'visualiser' );
}

window.addEventListener("load", init, false);

*/

(function(window) 
{
/*/======----- BEGIN -----=======/*/

// Set up public variables 
Bus.prototype.available = true;

// Set up static variables
Bus.playback = false;

// Set up private variables
var _context, _mixerVolume, _sound;
// default settings and song
var model =
{
	url:'',
	bufferTime:3,
	bufferTimeMax:0,
	volume:1
}

// Constructor
function Bus( id ) 
{
	// 
}

function createNative()
{
	var sound = create();
	
	if ( _context == null ) throw Error ( "No <audio> mp3 support" );
	
	// Load a sound file using an ArrayBuffer XMLHttpRequest.
	var request = new XMLHttpRequest();
	request.open("GET", model.url, true);
	request.responseType = "arraybuffer";
	request.onload = function(e)
	{
		// Create a buffer from the response ArrayBuffer.
		var buffer = _context.createBuffer(this.response, false);
		_sound.buffer = buffer;

		// Make the sound source use the buffer and start playing it.
		sound.source.buffer = sound.buffer;
		sound.source.noteOn( _context.currentTime );
	};
	request.send();

	/*/======------ END ------=======/*/
}

function create()
{
		// Create a new audio context.
	_context = new AudioContext();

	if ( _context == null ) return null;
	
	// Create a AudioGainNode to control the main volume.
	_mixerVolume = _context.createGainNode();
	// Connect the main volume node to the context destination.
	_mixerVolume.connect(_context.destination);

	// Create an object with a sound source and a volume control.
	var sound = {};
	sound.source = _context.createBufferSource();
	sound.volume = _context.createGainNode();

	// Connect the sound source to the volume control.
	sound.source.connect(sound.volume);
	// Hook up the sound volume control to the main volume.
	sound.volume.connect(_mixerVolume);

	// Make the sound source loop.
	sound.source.loop = true;
	
	return sound;
};

function destroy()
{
};


Bus.prototype.volume = function ( vol )
{
	
}

/* == Bind this canvas instance to this class == */
Bus.prototype.isAvailable = function ( id )
{
	// Detect if the audio context is supported.
	window.AudioContext = (
		window.AudioContext ||
		window.webkitAudioContext ||
		null
	);

	if (!AudioContext) {
		//throw new Error("AudioContext not supported!");
		return false;
	} else{
		return true;
	}

};

/*//////////////////////////////////////////////////////////////
Perform any visual processing before the audio data is read 
such as clearing the canvas or 
//////////////////////////////////////////////////////////////*/

// Expose to global scope
// Override self executing anonymous function by binding
// The anonymous method to the window object for reading externally
window.Bus = Bus;

/* self executing anonymous function */
} (window) );