/// <reference path="../audiobus/Dependencies.ts"/>

module examples
{
	export class Main
	{
		// Instruments
		private drums:audiobus.instruments.DrumMachine;
		private bass:audiobus.instruments.basics.Oscillator;

		// Timing
		private metronome:audiobus.timing.Metronome;
		private netronome:audiobus.timing.Netronome;

		private midiDevice:audiobus.io.MidiHardware;
		private midiFile:audiobus.io.MidiFile;

		private harmongraph:audiobus.visualisation.visualisers.Harmongraph;

		// Begin here
		constructor(  )
		{

			var context:AudioContext = audiobus.Engine.create(window);
			var volume:GainNode = context.createGain();
			//var destination = context.destination;
			//volume.connect( context.destination );

			// MIDI File : Load in data
			this.midiFile = new audiobus.io.MidiFile();
			this.midiFile.load( "assets/midi/chopin-polishdance.mid", (midiTrack:audiobus.io.MidiTrack)=>this.onMidiFile(midiTrack) );


			// Instruments :
			// -----------------------------------------------
			// Create a drum kit
			this.drums = new audiobus.instruments.DrumMachine( context, volume );
			//this.drums.trigger();
			//this.drums.trigger(1);
			//this.drums.trigger(2);
			//this.drums.trigger(3);
			//this.drums.trigger(4);

			//this.bass = new audiobus.instruments.basics.SawToothWave( context, volume );
			//this.bass = new audiobus.instruments.basics.SquareWave( context, volume );
			//this.bass = new audiobus.instruments.basics.TriangleWave( context, volume );
			this.bass = new audiobus.instruments.basics.SineWave( context, volume );
			//this.bass.volume = 1;

			var square = new audiobus.instruments.basics.SquareWave( context, volume );

			// Timing :
			// -----------------------------------------------
			this.netronome = new audiobus.timing.Netronome();
			this.netronome.ontick = (time) => {
	            console.log("tick "+time);
				//square.start( (Math.random()*440)+440 );
				//this.drums.trigger(1);
	        };
			//this.netronome.start( 90 );

			this.metronome = new audiobus.timing.Metronome();
			this.metronome.ontick = (time) => {
	            console.log("tick "+time);
	        };
			// this.netronome.start( 90 );

			/**/
			// Visualisations :
			// -----------------------------------------------
			var analyser:audiobus.visualisation.SpectrumAnalyzer = new audiobus.visualisation.SpectrumAnalyzer( context, audiobus.visualisation.SpectrumAnalyzer.TYPE_FREQUENCY );
			var canvas = analyser.createCanvas( 512, 512, 'visualiser' );
			analyser.connect( context.destination, volume );
			this.harmongraph = new audiobus.visualisation.visualisers.Harmongraph();
			//this.harmongraph.createCanvas( 512, 512 );
			//this.harmongraph.appendSlave( new audiobus.visualisation.visualisers.Plasma() );
			//this.harmongraph.prependSlave( new audiobus.visualisation.visualisers.Plasma() );
			// now hook into our analyser for updates
			analyser.append( this.harmongraph );

			var bars = new audiobus.visualisation.visualisers.Bars();
			//analyser.append( bars );

			var scope = new audiobus.visualisation.visualisers.Scope();
			//analyser.append( scope );

			// console.log( this.harmongraph.toString() );

			var counter:number = 1;
			analyser.onanalysis = (spectrum:Uint8Array) => {
				// and send the updates to the visualiser

				if (this.harmongraph)
				{
					this.harmongraph.zRatio = 1+(counter++/1208)%1200;
					this.harmongraph.xPhase += 0.0003;//
					this.harmongraph.yPhase += 0.0002;//
					this.harmongraph.zPhase += 0.0001;
					//console.log( "analyser::", spectrum );
				}

	        };
			analyser.start();


			// Interactions :
			// -----------------------------------------------
			// Attach key event
			document.onkeydown = (event:KeyboardEvent) => {
	            this.onKeyDown(event);
	        };
			document.onkeyup = (event:KeyboardEvent) => {
	            this.onKeyUp(event);
	        };

			// Watch for page scrolling :
			document.onscroll = (event) => {
	            this.onPageScroll(event);
	        };


			// Watch for mouse events :
			document.onmousedown = (event:MouseEvent) => {
	            this.onMouse(event);
	        };

			document.onmouseup = (event:MouseEvent) => {
	            this.onMouse(event);
	        };
			document.onmousemove = (event:MouseEvent) => {
	            this.onMouse(event);
	        };

			//document.onmousewheel = (event:MouseEvent) => {
	        //    this.onMouseWheel(event);
	        //};

			if (window.DeviceOrientationEvent !== undefined)
			{
		        window.addEventListener("devicemotion", (event)=>this.onDeviceMotion(event ), true);
				window.addEventListener("deviceorientation", (event)=>this.onDeviceOrientation(event ), true);
			}


			if (window.cordova)
			{
				// we are in Cordova world...
				// meaning we are in a phone or tablet
			}


			// MIDI :
			// Watch for MIDI input :
			//this.midiDevice = new audiobus.io.Midi();
			this.midiDevice = new audiobus.io.devices.TB3();

			// start watching for midi input...
			this.midiDevice.onmidimessage = (event) => {
				this.onMIDIMessage(event);
			};

			this.midiDevice.connect();

			// Microphone Input :
			// var mic = new audiobus.inputs.Microphone( this.drums.dsp, this.drums.gain );
			// mic.getMic();

			// Now let's route this all to a midi output

			// and load in our MIDI file if requested...
		}

		private sendMIDI( )
		{
			// this.midiDevice.send( );
		}

		// EVENTS ======= Stuff Happening! ==========

		// EVENT :
		// Midi file has loaded or failed to load!
		private onMidiFile( midiTrack:audiobus.io.MidiTrack )
		{
			console.error(midiTrack);
		}

		// EVENT :
		// a Midi message has been received
		private onMIDIMessage( e:audiobus.io.MidiCommand )
		{
			// now assign some instruments for the different channels...
			switch(e.action)
			{
				case audiobus.io.MidiCommand.ACTION_NOTE_OFF:
					this.bass.stop();
					break;

				case audiobus.io.MidiCommand.ACTION_NOTE_ON:
					console.log( e.toString() );
					this.bass.start( audiobus.io.Midi.frequencyFromNote( e.note ) );
					break;

				case audiobus.io.MidiCommand.ACTION_PITCH_BEND:
					this.bass.note( audiobus.io.Midi.frequencyFromNote( e.note ) );
					break;
			}
		}

		// EVENT : A User has scrolled the window
		private onPageScroll(e)
		{
			var doc:HTMLElement = document.documentElement;
			var left:number = window.pageXOffset || doc.scrollLeft;
			var top:number = window.pageYOffset || doc.scrollTop;

			var progressX:number = left / (doc.scrollWidth - window.innerWidth);
			var progressY:number = top / (doc.scrollHeight - window.innerHeight);
			//console.log('Progress : ', progressX, progressY);
			this.bass.note( 110 + progressY *440 );
		}

		// EVENT :
		// The physical orientation of the device,
		// expressed as a series of rotations from a local coordinate frame
		private onDeviceOrientation(event)
		{

		}

		// EVENT :
		// the acceleration of the device, expressed in Cartesian coordinates
		// in a coordinate frame defined in the device.
		// It also supplies the rotation rate of the device about a local coordinate frame.
		private onDeviceMotion(event)
		{
			// gamma is the left-to-right tilt in degrees, where right is positive
		    var tiltLR = event.gamma;

		    // beta is the front-to-back tilt in degrees, where front is positive
		    var tiltFB = event.beta;

		    // alpha is the compass direction the device is facing in degrees
		    var dir = event.alpha;

			// Accelerometer
			var aX = event.accelerationIncludingGravity.x*1;
			var aY = event.accelerationIncludingGravity.y*1;
			var aZ = event.accelerationIncludingGravity.z*1;
			//The following two lines are just to calculate a
			// tilt. Not really needed.
			// xPosition = Math.atan2(aY, aZ);
			// yPosition = Math.atan2(aX, aZ);
		}

		// EVENT : Wheel of the mouse has triggered
		// You may want to disable page scrolling as
		// the mouse wheel will also trigger the window scroll position!
		private onMouseWheel(e:MouseEvent)
		{
			// this.bass.note( e. );
			// If you want to disable window scrolling...
			//e.preventDefault();
		}

		// EVENT : Some kind of mouse interaction
		private onMouse(e:MouseEvent)
		{
			var type:string = e.type;

			switch(type)
			{
				// down
				case "mousedown":
					this.bass.start();
					break;

				case "mousemove":
				//	console.error(e);
					if (this.harmongraph)
					{
						this.harmongraph.xPhase = 10 * e.clientX / window.innerWidth;
						this.harmongraph.yPhase = 8 * e.clientY / window.innerHeight;
					}
					break;

				// up
				default:
					this.bass.stop();
			}
		}

		private onKeyDown(e:KeyboardEvent)
		{
			//if (!e)	{ e = window.event; };
			switch( e.keyCode )
			{
				//keyCode 37 is left arrow
				case 37:
					this.drums.trigger(0);
					break;

				case 38:
				//keyCode 38 is up arrow
					this.drums.trigger(6);
					break;

				case 39:
				//keyCode 39 is right arrow
					this.drums.trigger(9);
					break;

				case 40:
				//keyCode 40 is down arrow
					this.drums.tom.start();

					//this.drums.trigger(12);
					break;

				default:
					this.bass.start( e.keyCode * 3 );
			}
		}

		// EVENT : A User has pressed a key
		private onKeyUp(e:KeyboardEvent)
		{
			//if (!e)	{ e = window.event; };
			switch( e.keyCode )
			{
				default:
					this.bass.stop( );
			}
		}

	}
}
