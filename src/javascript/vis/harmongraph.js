function HarmonGraph( context, width, height )
{
	var _context		= context;
	var _centreX		= width >> 1;
	var _centreY		= height >> 1;
	
	var _amplitude 		= 150;
	var _iterations 	= 5120;
	
	this.xRatio 		= 3;
	this.xPhase 		= 0;

	this.yRatio 		= 2;
	this.yPhase 		= 0;			
	
	this.zRatio 		= 3;
	this.zPhase 		= 0;
	
	var _decay 			= 2/10000;

	// Appearance
	var _opacity 		= 0;
	var _r 				= 0;
	var _g 				= 0;	// 255
	var _b 				= 0;
	//var _thickness 		= 0.5;

	var section_length 	= 20;
	var deg2rad 		= Math.PI/180;		// Factor to convert degs to radians

	//var bitmapData		= context.createImageData( width , height );
	var bitmapData		= context.getImageData(0, 0, width, height);

	
	
	console.log( "HarmonGraph Initialised x:"+_centreX+" y:"+_centreY+" bitmap:"+bitmapData );
	
	drawBitmap = function( )
	{
		//for (i=0; i<bitmapData.width*bitmapData.height*4;i+=4)
		_context.putImageData(bitmapData,0,0);
	}
	
	clearScreen = function()
	{
		// Store the current transformation matrix
		bitmapData = _context.createImageData(bitmapData);
	}
	
	drawPixel = function( x, y, r, g, b, opacity )
	{
		x = parseInt(x);
		y = parseInt(y);
		var i = (x + y * bitmapData.width) * 4;
		//console.log( "drawPixel x:"+x+" y:"+y+" i:"+i );
		bitmapData.data[i+0] = r;
		bitmapData.data[i+1] = g;
		bitmapData.data[i+2] = b;
		bitmapData.data[i+3] = opacity;
	}
	// x(t) = A(t) * sin(wx*t + px) + A(t) * sin(ws*t + ps)
	// y(t) = A(t) * sin(wy*t + py)
	// A(t) = A(t-1)(1 - d)
	this.plot = function( spectrum )
	{
		// clear screen in preProcess() :)
		var x, y, ox, oy;
		var a = _amplitude;
		var s = 0;
		var xp = this.xPhase;
		var yp = this.yPhase;
		var zp = this.zPhase;
		var index 			= 0;
		//_context.fillStyle = "rgba("+_r+","+_g+","+_b+","+_opacity+")";
		//_context.strokeStyle = "rgba("+_r+","+_g+","+_b+","+_opacity+")";
		//_context.strokeStyle = "rgb("+_r+","+_g+","+_b+")";
		//_context.beginPath();		
			
		// Clear Screen();
		// Store the current transformation matrix
		bitmapData = _context.createImageData(bitmapData);
		
		for (var t = 0; t < 5120; t++)
		{
			_opacity = parseInt( t*0.2 );
			
			var level = (spectrum[ t%256 ] );//*0.5;
			//var level = (spectrum[ t%256 ] + 1);//*0.5;
			//var level = (spectrum[ _opacity ] + 1);//*0.5;
			var sector = 2;//(spectrum[ t%256 ] + 1);//*0.5; level *
			
			x = level * a * Math.sin(this.xRatio * t * deg2rad + xp) + a * Math.sin(this.zRatio * t * deg2rad + zp );
			y = level * a * Math.sin(this.yRatio * t * deg2rad + yp);
			// z = ;
			a *= (1 - _decay);
			
			drawPixel( _centreX + sector*x, _centreY + sector* y, _r, _g, _b , _opacity);
			
			/*
			if (s == 0)
			{
				// Create new line section
			
				
				if (t == 0)
				{
					//_context.moveTo(x, y);
					drawPixel( x, y, _r, _g, _b , _opacity);
				} else {
					//_context.moveTo(ox, oy);
					//_context.lineTo(x, y);
					//drawPixel( ox, oy, _r, _g, _b , _opacity);
					drawPixel( x, y, _r, _g, _b , _opacity);
				}
				//plot.addChild(l);
			} else {
				// Append to line section
				//_context.lineTo(x, y);
				drawPixel( x, y, _r, _g, _b , _opacity);
			}
			ox = x;
			oy = y;
			*/
			
			
			
			s++;
			
			//console.log( "Harmon Graph "+s );
			
			if (s == section_length) s = 0;
		}
		
		//_context.stroke();
		// draw shapes to canvas!
		_context.putImageData(bitmapData,0,0);
	}
};