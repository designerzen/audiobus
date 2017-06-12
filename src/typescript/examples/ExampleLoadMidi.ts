/// <reference path="../audiobus/Dependencies.ts"/>
module examples
{
	export class ExampleLoadMidi extends Example
	{
		// Begin here
		constructor(  )
		{
			super();
			const context:AudioContext = audiobus.Engine.create(window);
			const volume:GainNode = context.createGain();
		}

		private loadMidiFile()
		{
			// MIDI File : Load in data
			this.midiFile = new audiobus.io.MidiFile();
			this.midiFile.load( "assets/midi/chopin-polishdance.mid", (midiTrack:audiobus.io.MidiTrack)=>this.onMidiFile(midiTrack) );

		}

		// EVENT :
		// Midi file has loaded or failed to load!
		private onMidiFile( midiTrack:audiobus.io.MidiTrack )
		{
			console.error(midiTrack);
			//midiTrack.start();
		}

		// EVENT :
		// a Midi message has been received
		private onMIDIMessage( e:audiobus.io.MidiCommand )
		{
			console.log( e.toString() );
			// now assign some instruments for the different channels...
			switch(e.action)
			{
				case audiobus.io.MidiCommand.ACTION_NOTE_OFF:
					break;

				case audiobus.io.MidiCommand.ACTION_NOTE_ON:
					break;

				case audiobus.io.MidiCommand.ACTION_PITCH_BEND:
					break;
			}
		}

	}
}
