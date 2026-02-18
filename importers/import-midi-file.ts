import { Midi } from "@tonejs/midi"
import type { IAudioCommand } from "../audio-command-interface"
import { NOTE_OFF, NOTE_ON } from '../commands'
import AudioCommand from "../audio-command"

export const importMIDIFile = async(file: File) => {
	const arrayBuffer = await file.arrayBuffer()

	// Parse MIDI using @tonejs/midi
	const midi = new Midi(arrayBuffer)

	// Convert MIDI tracks to audio events
	const commands: IAudioCommand[] = []
	let noteCount = 0

	// Process all tracks
	for (const track of midi.tracks) {
		// Process all notes in the track
		for (const note of track.notes) {
			noteCount++
			
			// Create NOTE_ON
			const noteOn = new AudioCommand()
			noteOn.type = NOTE_ON
			noteOn.number = note.midi
			noteOn.velocity = note.velocity * 127 || 100  // @tonejs/midi uses 0-1, convert to 0-127
			noteOn.startAt = note.time
			noteOn.from = file.name
			noteOn.channel = track.channel
			noteOn.patch = track.instrument.number
			commands.push(noteOn)
			//console.info("note", {note}, "track", {track})
			
			// Create NOTE_OFF
			const noteOff = new AudioCommand()
			noteOff.type = NOTE_OFF
			noteOff.number = note.midi
			noteOff.velocity = note.velocity * 127 || 100
			noteOff.startAt = note.time + note.duration
			noteOff.from = file.name
			noteOff.channel = track.channel
			noteOff.patch = track.instrument.number
			commands.push(noteOff)
		}
	}

	// Sort by start time
	commands.sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

	console.info("MIDI file loaded successfully", { 
		fileName: file.name, 
		noteCount, 
		duration: midi.duration,
		tracks: midi.tracks.length,
		tempo: midi.header.tempos[0]?.bpm
	})

	return {
		commands,
		noteCount
	}
}



