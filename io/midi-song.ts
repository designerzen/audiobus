import { Midi } from "@tonejs/midi"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND } from "../commands/commands"
import type { IAudioCommand } from "../commands/audio-command-interface"

export interface SongEvent {
	at: number
	track: number
	voice?: string
	command: IAudioCommand
}
export interface MidiSong {
	midi: Midi
	events: SongEvent[]
	duration: number
	channels: number[]
}

/** Keep score identity separate from the controller that requests its performance. */
export function midiSong(midi: Midi): MidiSong {
	const events: SongEvent[] = []
	const channels = new Set<number>()
	midi.tracks.forEach((track, index) => {
		const channel = track.channel + 1
		if (track.notes.length) {
			channels.add(channel)
		}
		const add = (at: number, values: Partial<IAudioCommand>, voice?: string) => {
			events.push({
				at,
				track: index,
				voice,
				command: Object.assign(new AudioCommand(), {
					channel,
					from: `song:track:${index}`,
					startAt: at,
					time: at,
					...values
				})
			})
		}
		// Instruments apply before the first note, including on every loop.
		if (track.notes.length) {
			add(0, { type: PROGRAM_CHANGE, value: track.instrument.number })
		}
		track.notes.forEach((note, n) => {
			const voice = `${index}:${n}`
			add(
				note.time,
				{ type: NOTE_ON, number: note.midi, velocity: Math.round(note.velocity * 127) },
				voice
			)
			add(
				note.time + note.duration,
				{
					type: NOTE_OFF,
					number: note.midi,
					velocity: Math.round(note.noteOffVelocity * 127)
				},
				voice
			)
		})
		for (const [number, changes] of Object.entries(track.controlChanges)) {
			for (const change of changes) {
				add(change.time, {
					type: CONTROL_CHANGE,
					number: Number(number),
					value: Math.round(change.value * 127)
				})
			}
		}
		for (const bend of track.pitchBends) {
			add(bend.time, {
				type: PITCH_BEND,
				value: Math.max(0, Math.min(16383, Math.round((bend.value + 1) * 8192)))
			})
		}
	})
	// Stable ordering: setup, releases, then attacks at a shared timestamp.
	const priority = (command: IAudioCommand) =>
		command.type === NOTE_ON ? 2 : command.type === NOTE_OFF ? 1 : 0
	events.sort((a, b) => a.at - b.at || priority(a.command) - priority(b.command))
	return {
		midi,
		events,
		duration: events.reduce((duration, e) => Math.max(duration, e.at), midi.duration),
		channels: [...channels].sort((a, b) => a - b)
	}
}

export async function loadMidi(url: string): Promise<Midi> {
	const resolved = /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url)
		? url
		: `${import.meta.env.BASE_URL}${url}`
	const response = await fetch(resolved)
	if (!response.ok) {
		throw new Error(`Failed to fetch MIDI file: ${response.statusText}`)
	}
	const midi = new Midi(await response.arrayBuffer())
	if (!midi.tracks.some((track) => track.notes.length)) {
		throw new Error("MIDI file contains no playable notes")
	}
	return midi
}