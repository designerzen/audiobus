/// <reference path="audiobus/Dependencies.ts" />
class Main
{
	private drums:audiobus.DrumMachine;

	private midiInput:audiobus.io.Midi;
	private midiOutput:audiobus.io.Midi;

	static run():void
	{
		new Main();
	}

	// Begin here
	constructor(  )
	{
		// Instruments :
		// Create a drum kit
		this.drums = new audiobus.DrumMachine();
		//this.drums.trigger();
		//this.drums.trigger(1);
		//this.drums.trigger(2);
		//this.drums.trigger(3);
		//this.drums.trigger(4);

		// Visualisations :
		var viz = new audiobus.visualisation.SpectrumAnalyzer( this.drums.dsp, this.drums.gain );

		// now hook into our analyser for updates

		// Interactions :
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




		// MIDI :
		// Watch for MIDI input :
		this.midiInput = new audiobus.io.Midi();

		// start watching for midi input...
		this.midiInput.onmidimessage = (event) => {
			this.onMIDIMessage(event);
		};

		// Microphone Input :
		// var mic = new audiobus.inputs.Microphone( this.drums.dsp, this.drums.gain );
		// mic.getMic();


		// Now let's route this all to a midi output

		// Create MIDI output :
		// this.midiOutput = new audiobus.io.Midi();

		// and load in our MIDI file if requested...
	}

	// a Midi message has been received
	private onMIDIMessage(e)
	{
		// now assign some instruments for the different channels...
		console.log('');
	}

	// EVENT : A User has scrolled the window
	private onPageScroll(e)
	{
		console.log('');
	}

	// EVENT : Some kind of mouse interaction
	private onMouse(e)
	{
		var type:string = e.type;
		switch(type)
		{
			// down

			// up
			default:
				
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
				this.drums.trigger(1);
				break;

			case 38:
			//keyCode 38 is down arrow
				this.drums.trigger(2);
				break;

			case 39:
			//keyCode 39 is right arrow
				this.drums.trigger(3);
				break;

			case 40:
			//keyCode 40 is up arrow
				this.drums.trigger(4);
				break;
		}
	}

	private sendMIDI( )
	{
		// this.midiOutput.send( );
	}
}