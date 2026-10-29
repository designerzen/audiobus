import { noteNumberToName } from "../../conversion/note-to-name.ts"
import * as intervals from "../../tuning/intervals.ts"

export const SPEECH_ROOT_NAMES = [
	"C",
	"C#",
	"Db",
	"D",
	"D#",
	"Eb",
	"E",
	"F",
	"F#",
	"Gb",
	"G",
	"G#",
	"Ab",
	"A",
	"A#",
	"Bb",
	"B"
] as const

// Follow the chord definitions so new chord types are included automatically.
export const SPEECH_CHORD_QUALITIES = [
	...new Set(
		Object.keys(intervals)
			.filter((name) => /_CHORD_(?:EXTENDED_)?INTERVALS$/.test(name))
			.map((name) =>
				name
					.replace(/_CHORD_INTERVALS$/, "")
					.replace(/_CHORD_EXTENDED_INTERVALS$/, " extended")
					.replaceAll("_", " ")
					.toLowerCase()
					.replace(/add(\d+)/g, "add $1")
					.replace(/flat(\d+)/g, "flat $1")
					.replace(/sharp(\d+)/g, "sharp $1")
					.replace("power5", "power")
			)
	)
]

export const chordSpeechName = (root: string, quality: string): string => `${root} ${quality}`

export const SPEECH_VOCABULARY: readonly string[] = [
	...new Set([
		...Array.from({ length: 128 }, (_, note) => noteNumberToName(note)),
		...SPEECH_ROOT_NAMES,
		...SPEECH_ROOT_NAMES.flatMap((root) =>
			SPEECH_CHORD_QUALITIES.map((quality) => chordSpeechName(root, quality))
		)
	])
]

export const speechCacheKey = (text: string): string => `kokoro-v2-q8-bf_emma-speed1.03:${text}`

export function pronounceSpeech(text: string): string {
	return text.replace(
		/^([A-G])(#|b)?(-?\d+)?(?=\s|$)/,
		(_match, letter, accidental, octave) =>
			`${letter}${accidental === "#" ? " sharp" : accidental === "b" ? " flat" : ""}${octave ? ` ${octave.startsWith("-") ? `minus ${octave.slice(1)}` : octave}` : ""}`
	)
}