/// <reference path="audiobus/Dependencies.ts" />
/// <reference path="audiobus/Conductor.ts" />
class Main
{
	private drums:audiobus.instruments.DrumMachine;
	private bass:audiobus.instruments.basics.Oscillator;
	private netronome:audiobus.timing.Netronome;

	private midiInput:audiobus.io.Midi;
	private midiOutput:audiobus.io.Midi;
	private midiFile:audiobus.io.MidiFile;

	static run():void
	{
		new Main();
	}

	// Begin here
	constructor(  )
	{
		var context:AudioContext = audiobus.Conductor.create(window);
		var volume:GainNode = context.createGain();
		volume.connect( context.destination );

		// MIDI File : Load in data
		this.midiFile = new audiobus.io.MidiFile();
		this.midiFile.load( "midi/chopin-polishdance.mid", (event)=>this.onMidiFile(event) );


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
		this.bass = new audiobus.instruments.basics.SquareWave( context, volume );


		// Timing :
		// -----------------------------------------------
		this.netronome = new audiobus.timing.Netronome();
		this.netronome.ontick = (time) => {
            console.log("tick "+time);
        };
		// this.netronome.start( 90 );

		// Visualisations :
		// -----------------------------------------------
		var analyser:audiobus.visualisation.SpectrumAnalyzer = new audiobus.visualisation.SpectrumAnalyzer( context, volume );

		var visualiser = new audiobus.visualisation.visualisers.Harmongraph();
		visualiser.createCanvas( 512, 512 );
		// now hook into our analyser for updates

		var counter:number = 1;
		analyser.onanalysis = (spectrum:Uint8Array) => {
			// and send the updates to the visualiser
			visualiser.zRatio = 1+(counter++/128)%128;
			visualiser.xPhase += 0.02;//
			visualiser.yPhase += 0.01;//
			visualiser.zPhase += 0.01;
			visualiser.update( spectrum, window.performance.now() );
			//console.log( "analyser::", spectrum );
        };
		analyser.start();


		// Interactions :
		// -----------------------------------------------
		// Attach key event
		document.onkeydown = (event) => {
            this.onKeyDown(event);
        };

		// Watch for page scrolling :
		document.onscroll = (event) => {
            this.onPageScroll(event);
        };

		// Watch for mouse events :
		document.onmousedown  = (event) => {
            this.onMouse(event);
        };

		document.onmouseup  = (event) => {
            this.onMouse(event);
        };

		if (window.DeviceOrientationEvent !== undefined)
		{
	        window.addEventListener("devicemotion", (event)=>this.onDeviceMotion(event ), true);
	    }




		// MIDI :
		// Watch for MIDI input :
		//this.midiInput = new audiobus.io.Midi();
		this.midiInput = new audiobus.io.devices.TB3();

		// start watching for midi input...
		this.midiInput.onmidimessage = (event) => {
			this.onMIDIMessage(event);
		};

		this.midiInput.connect();

		//this.midiOutput = new audiobus.io.Midi();
		//this.midiOutput;


		// Microphone Input :
		// var mic = new audiobus.inputs.Microphone( this.drums.dsp, this.drums.gain );
		// mic.getMic();


		// Now let's route this all to a midi output

		// Create MIDI output :
		// this.midiOutput = new audiobus.io.Midi();

		// and load in our MIDI file if requested...
	}
	
	// Midi file has loaded or failed to load!
	private onMidiFile( e )
	{
		console.error(e);
	}

	// a Midi message has been received
	private onMIDIMessage( e:audiobus.io.MidiMessage )
	{
		// now assign some instruments for the different channels...
		switch(e.action)
		{
			case audiobus.io.MidiMessage.ACTION_NOTE_OFF:
				this.bass.stop();
				break;

			case audiobus.io.MidiMessage.ACTION_NOTE_ON:
				console.log( e.toString() );

				this.bass.start( audiobus.io.Midi.frequencyFromNote( e.note ) );
				break;

			case audiobus.io.MidiMessage.ACTION_PITCH_BEND:
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
		console.log('Progress : ', progressX, progressY);
		this.bass.note( progressY * 700 );
	}

	private onDeviceMotion(event)
	{
		// gamma is the left-to-right tilt in degrees, where right is positive
	    var tiltLR = event.gamma;

	    // beta is the front-to-back tilt in degrees, where front is positive
	    var tiltFB = event.beta;

	    // alpha is the compass direction the device is facing in degrees
	    var dir = event.alpha

		// Accelerometer
		var aX = event.accelerationIncludingGravity.x*1;
		var aY = event.accelerationIncludingGravity.y*1;
		var aZ = event.accelerationIncludingGravity.z*1;
		//The following two lines are just to calculate a
		// tilt. Not really needed.
		// xPosition = Math.atan2(aY, aZ);
		// yPosition = Math.atan2(aX, aZ);
	}

	// EVENT : Some kind of mouse interaction
	private onMouse(e)
	{
		console.error(e);
		var type:string = e.type;
		switch(type)
		{
			// down
			case "mousedown":
				this.bass.start();
				break;

			// up
			default:
				this.bass.stop();
		}
	}

	// EVENT : A User has pressed a key
	private onKeyDown(e)
	{
		if (!e)	{ e = window.event; };
		switch( e.keyCode )
		{
			//keyCode 37 is left arrow
			case 37:
				this.drums.trigger(1*4);
				break;

			case 38:
			//keyCode 38 is down arrow
				this.drums.trigger(2*4);
				break;

			case 39:
			//keyCode 39 is right arrow
				this.drums.trigger(3*4);
				break;

			case 40:
			//keyCode 40 is up arrow
				this.drums.trigger(4*4);
				break;
		}
	}

	private sendMIDI( )
	{
		// this.midiOutput.send( );
	}
}