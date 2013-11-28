/*

function init()
{
	registerCanvas( 'visualiser' );
}

window.addEventListener("load", init, false);

*/

(function(window) 
{
/*/======----- BEGIN -----=======/*/

// Set up private variables
var _context, _vis, _width, _height, _centreX, _centreY, _colour, _counter = 0;

// Set up public variables 
VisualBus.prototype.available = true;

// Set up static variables
VisualBus.playback = false;

// Constructor
function VisualBus( id, colour ) 
{
	bindCanvas( id );
	_colour = colour;
	_context.fillStyle = colour; 
	_context.fillRect( 0,0, _width, _height ); 
	
	_vis = new HarmonGraph( _context, _width, _height );
	
	/* 
	Perform any visual processing before the audio data is read 
	such as clearing the canvas or 
	*/
	/*this.preProcess = function()
	{
	};*/
	
	/* 
	Process the main data in realtime as fed from the audio file 
	*/
	/*this.process = function()
	{
	};*/
	
	/* 
	Once the data has been received, post process is called where you
	can add your own effects and post-processed effects
	*/
	/*this.postProcess = function()
	{
	};*/
	/*/======------ END ------=======/*/
}

/* == Bind this canvas instance to this class == */
VisualBus.prototype.registerCanvas = function ( id )
{
	bindCanvas( id );
};

VisualBus.prototype.update = function ( spectrumData )
{
	preProcess();
	process( spectrumData );
	postProcess();
	
	_counter++;
};

/*//////////////////////////////////////////////////////////////
Bind a <canvas> instance to this javascript drawing method
//////////////////////////////////////////////////////////////*/
function bindCanvas( id )
{
	// fetch canvas element
	var canvas = document.getElementById( id);
	// check for compatibility
	if ( canvas.getContext ) 
	{
		_context 	= canvas.getContext('2d');
		_width 		= canvas.width;
		_height 	= canvas.height;
		_centreX	= _width * 0.5;
		_centreY	= _height * 0.5;
		preProcess();
		return canvas;
	}else{
		// error, <canvas> not supported
		alert( "error, <canvas> not supported Canvas #id="+id+" failed" );
		return null;
	}
};

/*//////////////////////////////////////////////////////////////
Perform any visual processing before the audio data is read 
such as clearing the canvas or exptying an object
//////////////////////////////////////////////////////////////*/
function preProcess()
{
	//Utils.clearScreen( _context, _width, _height, _colour, 125 );
};

/*//////////////////////////////////////////////////////////////
Process the main data in realtime as fed from the audio file 
//////////////////////////////////////////////////////////////*/
function process( spectrumData )
{
	/*
	// test
	var width = _width / 6;
	var height = _height / 6;
	var radius = Math.random() * height / 2;

	for (var i=0; i<6; i++)
	{
		for (var j=0; j<6; j++)
		{
			_context.strokeStyle = 'rgb(0,' + Math.floor(255-42.5*i) + ',' + Math.floor(255-42.5*j) + ')';
			_context.beginPath();
			// (x, y, radius, startAngle, endAngle, anticlockwise)
			_context.arc( width*0.5+(j*width), height*0.5+(i*height), radius, 0, Math.random() *Math.PI*2, true);
			_context.stroke();
		}
    }
	*/
	
	/* Basic Beat Detection and to number conversion */
	for ( var i=0; i<256; ++i )
	{
		// 
		var l = parseInt( spectrumData[ i ] );
		var r = parseInt( spectrumData[ i+256 ] );
		
		spectrumData[ i ] = l;
		spectrumData[ i+256 ] = r;
		
		// spectrumData[i] *= -1 * Math.log((fft.bufferSize/2 - i) * (0.5/fft.bufferSize/2)) * fft.bufferSize;

		if ( l + r > 0.5 ) console.log("on beat");
		//else console.log( l + r );
	}	
	
	/*
	for ( var r=256; r<512; ++r )
	{
		
	}*/
	//console.log( _counter );
	//_vis.xRatio = parseInt(_counter%512)+1;
	_vis.zRatio = 1+parseInt(_counter/128)%128;
	_vis.xPhase += 0.02;//
	_vis.yPhase += 0.01;//
	_vis.zPhase += 0.01;
	_vis.plot( spectrumData );
};

/*////////////////////////////////////////////////////////////// 
Once the data has been received, post process is called where you
can add your own effects and post-processed effects
//////////////////////////////////////////////////////////////*/
function postProcess()
{
	
};

/*////////////////////////////////////////////////////////////// 
Handy drawing utilities and shortcuts
//////////////////////////////////////////////////////////////*/
Utils = 
{
	clearScreen:
	function clearScreen( canvas, width, height, colour, opacity )
	{
		// Store the current transformation matrix
		canvas.save();

		// Use the identity matrix while clearing the canvas
		canvas.setTransform(1, 0, 0, 1, 0, 0);
		canvas.clearRect(0, 0, width, height);

		// Restore the transform
		canvas.restore();
	}
};

// Expose to global scope
// Override anonymity of the self executing anonymous function by binding
// any anonymous methods to the window object for reading externally
// and exposing access
window.VisualBus = VisualBus;

/* self executing anonymous function */
} (window) );