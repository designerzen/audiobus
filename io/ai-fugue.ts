import { SCALE_FAMILIES, type HarmonicState } from "./harmony"
import type { ChordStep } from "./music-tools"

/**
 * A compact, token-efficient pattern format for language models, adapted from
 * the "fugue" format of simply-audio/droplets: notes carry their own beat and
 * duration, so the model writes rhythm as well as pitch.
 */
export interface FugueNote {
	beat: number
	number: number
	duration: number
	velocity: number
}
export interface FuguePattern {
	beats: number
	notes: FugueNote[]
}
export interface DrumPad {
	name: string
	note: number
}
/** What the model should know about the chain before it writes a part. */
export interface MusicalContext {
	harmony?: HarmonicState
	progression?: ChordStep[]
	outputs?: string[]
	drumPads?: readonly DrumPad[]
}

export const FUGUE_MAX_BEATS = 16
export const FUGUE_MAX_NOTES = 64
const NOTE_PATTERN = "^[A-Ga-g](#|b)?-?[0-9]$"
const PITCH_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
export const GENERAL_MIDI_DRUM_PADS: readonly DrumPad[] = [
	{ name: "Kick", note: 36 },
	{ name: "Snare", note: 38 },
	{ name: "Clap", note: 39 },
	{ name: "Closed hat", note: 42 },
	{ name: "Open hat", note: 46 },
	{ name: "Low tom", note: 45 },
	{ name: "High tom", note: 50 },
	{ name: "Crash", note: 49 },
	{ name: "Ride", note: 51 }
]

export const FUGUE_SCHEMA = {
	type: "object",
	required: ["beats", "notes"],
	properties: {
		beats: { type: "integer", minimum: 1, maximum: FUGUE_MAX_BEATS },
		notes: {
			type: "array",
			minItems: 1,
			maxItems: FUGUE_MAX_NOTES,
			items: {
				type: "object",
				required: ["beat", "note", "duration"],
				properties: {
					beat: { type: "number", minimum: 0, maximum: FUGUE_MAX_BEATS },
					note: {
						anyOf: [
							{ type: "string", pattern: NOTE_PATTERN },
							{ type: "integer", minimum: 0, maximum: 127 }
						]
					},
					duration: { type: "number", minimum: 0.0625, maximum: FUGUE_MAX_BEATS },
					velocity: { type: "integer", minimum: 1, maximum: 127 }
				}
			}
		}
	}
}

/** Scientific pitch notation, middle C = C4 = 60. */
export function noteNumber(value: unknown): number {
	if (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 127) {
		return value as number
	}
	const match =
		typeof value === "string" ? /^([A-Ga-g])(#|b)?(-?[0-9])$/.exec(value.trim()) : null
	if (match) {
		const number =
			LETTERS[match[1].toLowerCase()] +
			(match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) +
			(Number(match[3]) + 1) * 12
		if (number >= 0 && number <= 127) {
			return number
		}
	}
	throw new Error(`AI returned an invalid note: ${String(value).slice(0, 12)}`)
}

export function noteName(number: number): string {
	return `${PITCH_NAMES[number % 12]}${Math.floor(number / 12) - 1}`
}

const finite = (value: unknown, low: number, high: number): value is number =>
	typeof value === "number" && Number.isFinite(value) && value >= low && value <= high

/** Accept model or saved output; notes beyond the loop are dropped and long notes trimmed. */
export function parseFugue(value: unknown): FuguePattern {
	const pattern = value as { beats?: unknown; notes?: unknown }
	if (
		!pattern ||
		!Number.isInteger(pattern.beats) ||
		!finite(pattern.beats, 1, FUGUE_MAX_BEATS) ||
		!Array.isArray(pattern.notes) ||
		pattern.notes.length > FUGUE_MAX_NOTES
	) {
		throw new Error(`AI must return a 1–${FUGUE_MAX_BEATS} beat pattern of notes.`)
	}
	const beats = pattern.beats
	const notes = pattern.notes
		.map((note) => {
			if (
				!note ||
				!finite(note.beat, 0, FUGUE_MAX_BEATS) ||
				!finite(note.duration, 0.0625, 64)
			) {
				throw new Error("AI returned a note without a valid beat and duration.")
			}
			return {
				beat: note.beat,
				number: noteNumber(note.note ?? note.number),
				duration: Math.min(note.duration, beats - note.beat),
				velocity: Math.round(finite(note.velocity, 1, 127) ? note.velocity : 100)
			}
		})
		.filter((note) => note.beat < beats)
		.sort((a, b) => a.beat - b.beat)
	if (!notes.length) {
		throw new Error("AI returned no notes inside the pattern.")
	}
	return { beats, notes }
}

function pitchClassNames(mask: number): string[] {
	return PITCH_NAMES.filter((_, pitch) => mask & (1 << pitch))
}

/** The scale family relative to the tonic, from absolute pitch-class masks. */
function describeKey({ root, scale }: HarmonicState): string | undefined {
	if ((scale & 4095) === 4095) {
		return undefined
	}
	const relative = ((scale >> root) | (scale << (12 - root))) & 4095
	const family = SCALE_FAMILIES.find(({ mask }) => mask === relative)
	return `${PITCH_NAMES[root]} ${family?.name.toLowerCase() ?? "scale"} (${pitchClassNames(scale).join(" ")})`
}

/**
 * Plain-text context for the prompt, like droplets' get_project_state: the key,
 * chords, instrument and real drum pads, so the model writes notes that fit.
 */
export function describeMusicalContext(context: MusicalContext, mode: string, bpm: number): string {
	const lines = [`Tempo ${Math.round(bpm)} BPM in 4/4; beat 0 is the downbeat.`]
	const key = context.harmony && describeKey(context.harmony)
	if (key && mode !== "drums") {
		lines.push(`Key: ${key}. Use only these pitch classes.`)
	}
	if (context.progression?.length && mode !== "drums") {
		lines.push(
			`Chord progression to follow: ${context.progression
				.slice(0, 16)
				.map(({ name, beats }) => `${name} (${beats} beats)`)
				.join(", ")}.`
		)
	}
	if (context.outputs?.length) {
		lines.push(`Played by: ${context.outputs.slice(0, 4).join(", ")}.`)
	}
	if (mode === "drums") {
		const pads = context.drumPads?.length ? context.drumPads : GENERAL_MIDI_DRUM_PADS
		lines.push(
			`Drum pads as MIDI numbers, use these exactly: ${pads
				.slice(0, 24)
				.map(({ name, note }) => `${name} ${note}`)
				.join(", ")}.`
		)
	}
	return lines.join("\n")
}

const MODE_GUIDANCE: Record<string, string> = {
	melody: "a melody, mostly single notes between C4 and C6",
	bass: "a bass line, single notes between E1 and G3",
	drums: "a drum pattern; write each hit as its pad MIDI number with duration 0.25",
	chord: "chords, three or four notes sharing the same beat"
}

export function fuguePrompt(description: string, mode: string, context: string): string {
	return (
		`Write ${MODE_GUIDANCE[mode] ?? MODE_GUIDANCE.melody} as a loop of 1–${FUGUE_MAX_BEATS} beats. ` +
		'Return JSON {"beats": loop length, "notes": [{"beat", "note", "duration", "velocity"}]}. ' +
		'"beat" and "duration" are in quarter-note beats, so 0.5 is an eighth note. ' +
		'"note" is a name such as "C4" (middle C) or a MIDI number. ' +
		"Vary velocity (1–127) for accents.\n" +
		`${context}\nDescription: ${description}`
	)
}