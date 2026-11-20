import { recordingVoices, exportTempo, type NoteRecording } from "../formats/note-sequence"

const quote = (text: string) =>
	'"' +
	text
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/[\r\n]/g, " ") +
	'"'
const length = (ticks: number) => {
	let a = ticks,
		b = 1920
	while (b) {
		const remainder = a % b
		a = b
		b = remainder
	}
	return `1*${ticks / a}/${1920 / a}`
}
const pitch = (number: number) => {
	const names = ["c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b"]
	const octave = Math.floor(number / 12) - 4
	return names[number % 12] + (octave >= 0 ? "'".repeat(octave) : ",".repeat(-octave))
}

/** Absolute-pitch LilyPond score with independent staves for overlapping voices. */
export function createLilyPondFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = Math.round(exportTempo(timer)),
		voices = recordingVoices(recording)
	if (bpm < 1) {
		throw new Error("LilyPond tempo must round to at least 1 BPM")
	}
	if (!voices.length) {
		throw new Error("Record some notes before exporting LilyPond")
	}
	const toTicks = (seconds: number) => Math.round(((seconds * bpm) / 60) * 480)
	const staves = voices.map((notes, index) => {
		let cursor = 0
		const tokens: string[] = []
		for (const note of notes) {
			const start = Math.max(cursor, toTicks(note.start)),
				duration = Math.max(1, toTicks(note.start + note.duration) - start)
			if (start > cursor) {
				tokens.push(`r${length(start - cursor)}`)
			}
			tokens.push(`${pitch(note.number)}${length(duration)}`)
			cursor = start + duration
		}
		return `  \\new Staff \\with { instrumentName = ${quote(`Channel ${notes[0].channel}, voice ${index + 1}`)} } { \\absolute { \\cadenzaOn \\tempo 4 = ${Math.round(bpm)} ${tokens.join(" ")} \\bar "|." } }`
	})
	return `\\version "2.24.3"\n\\language "nederlands"\n\\header { title = ${quote(recording.name)} }\n\\score {\n<<\n${staves.join("\n")}\n>>\n\\layout {}\n\\midi {}\n}\n`
}