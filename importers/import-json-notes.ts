import { Midi } from "@tonejs/midi"
import { songFromMIDI } from "../formats/song-midi"
import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import type { SequenceNote } from "../formats/note-sequence"

/** Tone.js Midi.toJSON() representation; seconds include its original tempo map. */
export async function importToneJSONFile(file: File) {
	checkMusicFile(file)
	const data = JSON.parse(await file.text())
	if (!data?.header || !Array.isArray(data.tracks) || data.tracks.length > 256) {
		throw new Error("Expected Tone.js MIDI JSON with a header and tracks")
	}
	const notes: SequenceNote[] = []
	for (const track of data.tracks) {
		if (!track || !Array.isArray(track.notes) || notes.length + track.notes.length > 100000) {
			throw new Error("Invalid Tone.js track or too many notes")
		}
		for (const note of track.notes) {
			if (
				!note ||
				typeof note.velocity !== "number" ||
				!Number.isFinite(note.velocity) ||
				note.velocity < 0 ||
				note.velocity > 1
			) {
				throw new Error("Tone.js note velocity must be between 0 and 1")
			}
			notes.push({
				number: note.midi,
				start: note.time,
				duration: note.duration,
				velocity: Math.round(note.velocity * 127),
				channel: typeof track.channel === "number" ? track.channel + 1 : NaN,
				patch: track.instrument?.number ?? 0
			})
		}
	}
	const result = commandsFromNotes(notes, file.name)
	// Tone.js reads the header's tempo map, meters, key and track names; hand-written JSON may omit them.
	try {
		const midi = new Midi()
		midi.fromJSON(data)
		return { ...result, song: songFromMIDI(midi, file.name) }
	} catch {
		return result
	}
}

/** JAMS note_midi / note_hz annotations. Other annotation namespaces are ignored. */
export async function importJAMSFile(file: File) {
	checkMusicFile(file)
	const data = JSON.parse(await file.text())
	if (!Array.isArray(data?.annotations)) {
		throw new Error("Expected JAMS annotations")
	}
	const notes: SequenceNote[] = []
	let index = 0
	for (const annotation of data.annotations) {
		if (!["note_midi", "note_hz"].includes(annotation?.namespace)) {
			continue
		}
		if (!Array.isArray(annotation.data) || notes.length + annotation.data.length > 100000) {
			throw new Error("Invalid JAMS note data or too many notes")
		}
		const metadata = annotation.sandbox?.harmoneasy
		const channel = metadata?.channel ?? (index % 16) + 1
		for (const point of annotation.data) {
			if (
				!point ||
				typeof point.value !== "number" ||
				!Number.isFinite(point.value) ||
				(annotation.namespace === "note_hz" && point.value <= 0)
			) {
				throw new Error("Invalid JAMS pitch")
			}
			const pitch =
				annotation.namespace === "note_hz"
					? 69 + 12 * Math.log2(point.value / 440)
					: point.value
			notes.push({
				number: Math.round(pitch),
				start: point.time,
				duration: point.duration,
				velocity: 100,
				channel,
				patch: metadata?.program ?? 0
			})
		}
		index++
	}
	return commandsFromNotes(notes, file.name)
}