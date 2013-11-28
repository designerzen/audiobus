
var lastTime = 0;
var vendors = ['ms', 'moz', 'webkit', 'o'];
for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
	window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
	window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
							   || window[vendors[x]+'CancelRequestAnimationFrame'];
}

if (!window.requestAnimationFrame)
	window.requestAnimationFrame = function(callback, element) {
		var currTime = new Date().getTime();
		var timeToCall = Math.max(0, 16 - (currTime - lastTime));
		var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
		  timeToCall);
		lastTime = currTime + timeToCall;
		return id;
	};

if (!window.cancelAnimationFrame)
	window.cancelAnimationFrame = function(id) {
		clearTimeout(id);
	};
	/* == Name Space == */
	var audioBus, visualBus;
	
	var file =
	{
		url:'',
		bufferTime:3,
		bufferTimeMax:0,
		volume:1
	}
	
	function init()
	{
		var params = {};
		params.allowScriptAccess = "always";
		params.wmode = "transparent";
		
		var attributes = {};
		attributes.id = "flashAudioPlayer";
		attributes.name = "flashAudioPlayer";
		var flashvars = { nameSpace:"audioBus", volume:file.volume };
		
		// embed the flash audio player
		swfobject.embedSWF( "bus.swf", "flashAudio", "400", "300", "10.1", "expressInstall.swf", flashvars, params, attributes );
	
		// register the flash player ( css id DIV, model data, name space set above )
		audioBus = new FlashAudioBus( attributes.id , file, flashvars.nameSpace );
		
		/*audioBus = new AudioBus( 'visualiser' );*/
		
		// register visualiser ( css id CANVAS )
		visualBus = new VisualBus( 'visualiser', '#FFFFFF' );	// , audioBus
		
		// now update the visualisers!
		update();
	};

	function update()
	{
		// first check to see if the flash has even loaded in yet :)
		//console.log( "Loaded?"+ audioBus.isLoaded );
		if (!audioBus.isLoaded)
		{
			setTimeout( update, 50 );
			return;
		}else{
			//setTimeout(update, 500 );
			window.requestAnimationFrame( update );
		}
		// fetch the spectrum data as a 512 byte array
		//var spectrum = [0,0];
		var spectrum = audioBus.fetchSpectrum();
		
		//console.log( "Spectrum Data : " + spectrum );
		
		//if (spectrum) 
		
		visualBus.update( spectrum );
	};
	
	function log( message )
	{
		console.log( "JS : " + message );	
	};
	