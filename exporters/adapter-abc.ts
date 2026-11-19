import {
	recordingNotes,
	exportTempo,
	type NoteRecording,
	type SequenceNote
} from "../formats/note-sequence"

function pitch(number: number) {
	const names = ["=C", "^C", "=D", "^D", "=E", "=F", "^F", "=G", "^G", "=A", "^A", "=B"]
	const octave = Math.floor(number / 12) - 1
	const name = names[number % 12]
	return octave >= 5 ? name.toLowerCase() + "'".repeat(octave - 5) : name + ",".repeat(4 - octave)
}
function length(ticks: number): string {
	let a = ticks,
		b = 480
	while (b) {
		const remainder = a % b
		a = b
		b = remainder
	}
	return `${ticks / a}/${480 / a}`
}

/** ABC 2.1 score export, with independent voices for overlapping notes. */
export function createABCFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = exportTempo(timer)
	const voices: { notes: SequenceNote[]; end: number; channel: number; patch: number }[] = []
	for (const note of recordingNotes(recording)) {
		const start = Math.round(((note.start * bpm) / 60) * 480)
		const duration = Math.max(1, Math.round(((note.duration * bpm) / 60) * 480))
		let voice = voices.find(
			(v) => v.channel === note.channel && v.patch === note.patch && v.end <= start
		)
		if (!voice) {
			voice = { notes: [], end: 0, channel: note.channel, patch: note.patch }
			voices.push(voice)
		}
		voice.notes.push({ ...note, start, duration })
		voice.end = start + duration
	}
	const title = recording.name.replace(/[\r\n%]/g, " ")
	const header = [
		"%abc-2.1",
		"X:1",
		`T:${title}`,
		"M:none",
		"L:1/4",
		`Q:1/4=${bpm}`,
		...voices.map((_, i) => `V:${i + 1}`),
		"K:C"
	]
	const body = voices.map((voice, i) => {
		let cursor = 0
		const tokens: string[] = []
		for (const note of voice.notes) {
			if (note.start > cursor) {
				tokens.push(`z${length(note.start - cursor)}`)
			}
			tokens.push(`${pitch(note.number)}${length(note.duration)}`)
			cursor = note.start + note.duration
		}
		return [
			`V:${i + 1}`,
			`[I:MIDI channel ${voice.channel}] [I:MIDI program ${voice.patch}] ${tokens.join(" ")} |]`
		].join("\n")
	})
	return [...header, ...body].join("\n") + "\n"
}