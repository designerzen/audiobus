import { recordingNotes, exportTempo, type NoteRecording } from "../formats/note-sequence"
import { RTTTL_DURATIONS } from "../formats/rtttl"

const lengths = RTTTL_DURATIONS.flatMap((denominator) => [
	{ denominator, ticks: 64 / denominator, dot: false },
	{ denominator, ticks: 96 / denominator, dot: true }
]).sort((a, b) => b.ticks - a.ticks)

/** Monophonic ringtone export, quantized to classic RTTTL note lengths. */
export function createRTTTLFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = Math.round(exportTempo(timer)),
		notes = recordingNotes(recording)
	if (bpm < 1 || bpm > 900) {
		throw new Error("RTTTL tempo must be 1–900 BPM")
	}
	if (!notes.length) {
		throw new Error("Record a melody before exporting RTTTL")
	}
	let end = 0
	for (const note of notes) {
		if (note.start < end - 1e-9) {
			throw new Error(
				"RTTTL requires a single melody without overlapping notes; use MML or MIDI for polyphony"
			)
		}
		if (note.number < 60 || note.number > 107) {
			throw new Error("RTTTL export requires notes in octaves 4–7")
		}
		end = note.start + note.duration
		if (end > 1800) {
			throw new Error("RTTTL export exceeds 30 minutes")
		}
	}
	const ticks = (seconds: number) => Math.round(((seconds * bpm) / 60) * 16)
	const tokens: string[] = []
	let cursor = 0
	const names = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]
	for (const [index, note] of notes.entries()) {
		const start = ticks(note.start)
		while (cursor < start) {
			const pause =
				lengths.find((length) => length.ticks <= start - cursor) ?? lengths.at(-1)!
			tokens.push(`${pause.denominator}p${pause.dot ? "." : ""}`)
			cursor += pause.ticks
		}
		const desired = Math.max(2, ticks(note.duration))
		if (desired > 96) {
			throw new Error("RTTTL cannot represent notes longer than a dotted whole note")
		}
		const available =
			index + 1 < notes.length ? ticks(notes[index + 1].start) - cursor : Infinity
		const candidates = lengths.filter((length) => length.ticks <= available)
		const length = (candidates.length ? candidates : lengths).reduce((best, item) =>
			Math.abs(item.ticks - desired) < Math.abs(best.ticks - desired) ? item : best
		)
		tokens.push(
			`${length.denominator}${names[note.number % 12]}${Math.floor(note.number / 12) - 1}${length.dot ? "." : ""}`
		)
		cursor += length.ticks
	}
	const title =
		recording.name
			.replace(/[^a-zA-Z0-9 _-]/g, "")
			.trim()
			.slice(0, 10) || "Tune"
	return `${title}:d=4,o=6,b=${bpm}:${tokens.join(",")}\n`
}