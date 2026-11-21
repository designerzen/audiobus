import { Midi } from "@tonejs/midi"
import { importedSong, normalizeSong, songTimeAxis, type SongSource } from "./song-source"

const MAJOR = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"]
const MINOR = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"]

/** Tonic name of a key signature */
export const keyName = (key: NonNullable<SongSource["key"]>) =>
	(key.mode === "minor" ? MINOR : MAJOR)[key.fifths + 7]

/** Key signature from a tonic name such as "F#" with "minor" */
export function keySignature(name: string, mode = "major"): SongSource["key"] {
	const minor = mode === "minor",
		index = (minor ? MINOR : MAJOR).indexOf(name)
	return index < 0 ? undefined : { fifths: index - 7, mode: minor ? "minor" : "major" }
}

// Tone.js names a key signature by its relative major, whatever the mode.
const toneKey = (key: string, scale: string): SongSource["key"] => {
	const index = MAJOR.indexOf(key)
	return index < 0
		? undefined
		: { fifths: index - 7, mode: scale === "minor" ? "minor" : "major" }
}

/** Song from a parsed MIDI file, keeping tempo, meter and key changes and track names */
export function songFromMIDI(midi: Midi, name: string): SongSource {
	const { header } = midi,
		key = header.keySignatures[0]
	return importedSong({
		name: header.name || name,
		tempos: header.tempos.map((tempo) => ({
			time: header.ticksToSeconds(tempo.ticks),
			bpm: tempo.bpm
		})),
		meters: header.timeSignatures.map((meter) => ({
			time: header.ticksToSeconds(meter.ticks),
			numerator: meter.timeSignature[0],
			denominator: meter.timeSignature[1]
		})),
		key: key && toneKey(key.key, key.scale),
		tracks: midi.tracks
			.filter((track) => track.notes.length)
			.map((track, index) => {
				const channel = track.channel + 1,
					patch = track.instrument.number
				return {
					name: track.name || `Track ${index + 1}`,
					source: name,
					channel,
					patch,
					notes: track.notes.map((note) => ({
						number: note.midi,
						start: note.time,
						duration: note.duration,
						velocity: Math.round(note.velocity * 127),
						channel,
						patch
					})),
					controllers: Object.values(track.controlChanges).flatMap((events) =>
						events.map((event) => ({
							time: event.time,
							controller: event.number,
							value: Math.round(event.value * 127)
						}))
					),
					pitchBends: track.pitchBends.map((event) => ({
						time: event.time,
						value: event.value
					}))
				}
			})
	})
}

/** MIDI file with the song's tempo map, meters, key and named tracks */
export function songMIDI(source: SongSource): Midi {
	const song = normalizeSong(source),
		axis = songTimeAxis(song),
		midi = new Midi(),
		ppq = midi.header.ppq,
		tick = (seconds: number) => Math.round(axis.ticks(seconds, ppq))
	midi.header.name = song.name
	midi.header.tempos = song.tempos.map((tempo) => ({ ticks: tick(tempo.time), bpm: tempo.bpm }))
	midi.header.timeSignatures = song.meters.map((meter) => ({
		ticks: tick(meter.time),
		timeSignature: [meter.numerator, meter.denominator]
	}))
	if (song.key) {
		midi.header.keySignatures = [
			{ ticks: 0, key: MAJOR[song.key.fifths + 7], scale: song.key.mode }
		]
	}
	midi.header.update()
	for (const source of song.tracks) {
		const track = midi.addTrack()
		track.name = source.name
		track.channel = source.channel - 1
		track.instrument.number = source.patch
		for (const note of source.notes) {
			const start = tick(note.start)
			track.addNote({
				midi: note.number,
				ticks: start,
				durationTicks: Math.max(1, tick(note.start + note.duration) - start),
				velocity: note.velocity / 127
			})
		}
		for (const event of source.controllers ?? []) {
			track.addCC({
				number: event.controller,
				ticks: tick(event.time),
				value: event.value / 127
			})
		}
		for (const event of source.pitchBends ?? []) {
			track.addPitchBend({ ticks: tick(event.time), value: event.value })
		}
	}
	return midi
}

/** Standard MIDI file bytes. Tone.js writes key signatures with the wrong number of sharps or
 * flats, so rewrite them from the header in the conductor track.
 */
export function midiBytes(midi: Midi): Uint8Array<ArrayBuffer> {
	const bytes = Uint8Array.from(midi.toArray()),
		keys = midi.header.keySignatures.map((key) => MAJOR.indexOf(key.key) - 7)
	const view = new DataView(bytes.buffer)
	let at = 14
	if (!keys.length || new TextDecoder().decode(bytes.subarray(at, at + 4)) !== "MTrk") {
		return bytes
	}
	const end = Math.min(bytes.length, at + 8 + view.getUint32(at + 4))
	const varint = () => {
		let value = 0
		do {
			value = (value << 7) | (bytes[at] & 0x7f)
		} while (bytes[at++] & 0x80 && at < end)
		return value
	}
	at += 8
	// The conductor track holds only meta events.
	while (at < end && keys.length) {
		varint()
		if (bytes[at] !== 0xff) {
			break
		}
		const type = bytes[at + 1]
		at += 2
		const length = varint()
		if (type === 0x59 && length === 2) {
			bytes[at] = keys.shift()! & 0xff
		}
		at += length
	}
	return bytes
}