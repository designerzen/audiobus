/**
 * Chord detection, key estimation and next-chord suggestions
 * from played MIDI notes. Pure functions: no DOM, MIDI output or state.
 */
import { mod12 } from "./pitch-class-set"
import { CHORD_PROGRESSIONS } from "./progressions"

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const NAME_TO_PC: Record<string, number> = {
	C: 0,
	"B#": 0,
	"C#": 1,
	Db: 1,
	D: 2,
	"D#": 3,
	Eb: 3,
	E: 4,
	Fb: 4,
	"E#": 5,
	F: 5,
	"F#": 6,
	Gb: 6,
	G: 7,
	"G#": 8,
	Ab: 8,
	A: 9,
	"A#": 10,
	Bb: 10,
	B: 11,
	Cb: 11
}

/** Intervals in semitones from the root; compared as pitch classes when detecting */
export const CHORD_TYPES = {
	major: [0, 4, 7],
	minor: [0, 3, 7],
	diminished: [0, 3, 6],
	augmented: [0, 4, 8],

	maj7: [0, 4, 7, 11],
	dom7: [0, 4, 7, 10],
	min7: [0, 3, 7, 10],
	minMaj7: [0, 3, 7, 11],
	halfdim7: [0, 3, 6, 10],
	dim7: [0, 3, 6, 9],

	augMaj7: [0, 4, 8, 11],
	aug7: [0, 4, 8, 10],

	sus2: [0, 2, 7],
	sus4: [0, 5, 7],

	add9: [0, 4, 7, 14],
	madd9: [0, 3, 7, 14],
	add11: [0, 4, 7, 17],
	add6: [0, 4, 7, 9],
	madd6: [0, 3, 7, 9],

	"7b5": [0, 4, 6, 10],
	"7sharp5": [0, 4, 8, 10],
	"7b9": [0, 4, 7, 10, 13],
	"7sharp9": [0, 4, 7, 10, 15],
	"7b9b5": [0, 4, 6, 10, 13],

	power5: [0, 7],
	quartal: [0, 5, 10],
	quintal: [0, 7, 14]
} as const satisfies Record<string, readonly number[]>

export type ChordType = keyof typeof CHORD_TYPES
export type KeyMode = "major" | "minor"
export type SuggestionGroup = "diatonic" | "functional" | "relative" | "chromatic"

export interface SuggestedChord {
	rootPc: number
	type: ChordType
	label: string
	/** likelihood of the progression, 0-1 */
	weight?: number
	/** MIDI note of the octave the root was played in */
	octaveOffset?: number
	group?: SuggestionGroup
}

export interface MusicalKey {
	name: string
	rootPc: number
	mode: KeyMode
}

export interface KeyScore extends MusicalKey {
	score: number
}

export interface GroupedSuggestions {
	key: MusicalKey
	diatonic: SuggestedChord[]
	functional: SuggestedChord[]
	relative: SuggestedChord[]
	chromatic: SuggestedChord[]
}

const MAJOR_KEY_NAMES = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab"]
const MINOR_KEY_NAMES = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#", "D", "G", "C", "F"]

export const KEYS: MusicalKey[] = [
	...MAJOR_KEY_NAMES.map((name) => ({ name, rootPc: NAME_TO_PC[name], mode: "major" as const })),
	...MINOR_KEY_NAMES.map((name) => ({
		name: name + "m",
		rootPc: NAME_TO_PC[name],
		mode: "minor" as const
	}))
]

const MAJOR_TRIADS: Array<[number, ChordType]> = [
	[0, "major"],
	[2, "minor"],
	[4, "minor"],
	[5, "major"],
	[7, "major"],
	[9, "minor"],
	[11, "diminished"]
]
const MINOR_TRIADS: Array<[number, ChordType]> = [
	[0, "minor"],
	[2, "diminished"],
	[3, "major"],
	[5, "minor"],
	[7, "minor"],
	[8, "major"],
	[10, "major"]
]

const DOMINANT_TYPES: ChordType[] = ["major", "dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"]

const chordPitchClasses = (type: ChordType) => [...new Set(CHORD_TYPES[type].map(mod12))]

export const noteName = (pc: number, useFlats = false) =>
	(useFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]

/** "c#" → 1, "Bb" → 10, unknown → null */
export function noteNameToPc(name: string): number | null {
	const trimmed = name.trim()
	return NAME_TO_PC[trimmed.charAt(0).toUpperCase() + trimmed.slice(1)] ?? null
}

/** "7sharp5" → "7#5" */
export const displayChordType = (type: string) => type.replace(/sharp/g, "#")

/** Readable symbol: C, Cm, Cdim, Cmaj7, C7#5 ... */
export function chordToName(chord: Pick<SuggestedChord, "rootPc" | "type">): string {
	const root = noteName(chord.rootPc)
	switch (chord.type) {
		case "major":
			return root
		case "minor":
			return root + "m"
		case "diminished":
			return root + "dim"
		default:
			return root + displayChordType(chord.type)
	}
}

/** Parses simple triad symbols such as "D", "Dm" or "Bdim" */
export function parseChordName(name: string): SuggestedChord | null {
	const match = name.match(/^([A-G][b#]?)(m|dim)?$/)
	if (!match) {
		return null
	}
	const [, rootName, suffix] = match
	return {
		rootPc: NAME_TO_PC[rootName],
		type: suffix === "m" ? "minor" : suffix === "dim" ? "diminished" : "major",
		label: name,
		octaveOffset: 60
	}
}

function detectChordType(pcSet: number[]): ChordType | null {
	const root = pcSet[0]
	const intervals = pcSet.map((pc) => mod12(pc - root))
	for (const type of Object.keys(CHORD_TYPES) as ChordType[]) {
		const structure = chordPitchClasses(type)
		if (
			structure.length === intervals.length &&
			structure.every((interval) => intervals.includes(interval))
		) {
			return type
		}
	}
	return null
}

/**
 * Names the chord formed by the held MIDI notes, trying each note as root.
 * Returns null for fewer than two pitch classes or an unknown shape.
 */
export function detectChord(midiNotes: number[]): SuggestedChord | null {
	const pcSet = [...new Set(midiNotes.map(mod12))].sort((a, b) => a - b)
	if (pcSet.length < 2) {
		return null
	}
	for (let i = 0; i < pcSet.length; i++) {
		const rotated = pcSet.slice(i).concat(pcSet.slice(0, i))
		const type = detectChordType(rotated)
		if (type) {
			const rootPc = rotated[0]
			const playedRoot = midiNotes.find((note) => mod12(note) === rootPc)!
			return {
				rootPc,
				type,
				label: chordToName({ rootPc, type }),
				octaveOffset: playedRoot - rootPc
			}
		}
	}
	return null
}

/** Every chord the progression rules allow after this one, weighted by likelihood */
export function getNextChords(chord: Pick<SuggestedChord, "rootPc">): SuggestedChord[] {
	return CHORD_PROGRESSIONS.flatMap((rule) => {
		const rootPc = mod12(chord.rootPc + rule.step)
		return rule.types.map((type) => ({
			rootPc,
			type: type as ChordType,
			weight: rule.weight,
			label: chordToName({ rootPc, type: type as ChordType })
		}))
	})
}

export function findKey(name: string): MusicalKey | undefined {
	return KEYS.find((key) => key.name === name)
}

export function keyFor(rootPc: number, mode: KeyMode): MusicalKey {
	return KEYS.find((key) => key.rootPc === mod12(rootPc) && key.mode === mode)!
}

/** The seven diatonic triads of a key */
export function diatonicChords(key: MusicalKey): SuggestedChord[] {
	return (key.mode === "minor" ? MINOR_TRIADS : MAJOR_TRIADS).map(([degree, type]) => {
		const rootPc = mod12(key.rootPc + degree)
		return { rootPc, type, label: chordToName({ rootPc, type }), octaveOffset: 60 }
	})
}

const isDiatonic = (chord: Pick<SuggestedChord, "rootPc" | "type">, key: MusicalKey) =>
	diatonicChords(key).some((c) => c.rootPc === chord.rootPc && c.type === chord.type)

export const relativeMinor = (key: MusicalKey) => keyFor(key.rootPc + 9, "minor")
export const relativeMajor = (key: MusicalKey) => keyFor(key.rootPc + 3, "major")
export const dominantKey = (key: MusicalKey) => keyFor(key.rootPc + 7, key.mode)
export const subdominantKey = (key: MusicalKey) => keyFor(key.rootPc + 5, key.mode)

/** The key itself, its relative, and the dominant and subdominant of its major */
export function getRelativeKeys(key: MusicalKey): MusicalKey[] {
	const major = key.mode === "minor" ? relativeMajor(key) : key
	const minor = key.mode === "minor" ? key : relativeMinor(key)
	return [major, minor, dominantKey(major), subdominantKey(major)]
}

/** A dominant-quality chord resolving down a fifth onto a diatonic root (V/x) */
export function isSecondaryDominant(chord: SuggestedChord, key: MusicalKey): boolean {
	const target = mod12(chord.rootPc + 5)
	return (
		DOMINANT_TYPES.includes(chord.type) &&
		diatonicChords(key).some((c) => c.rootPc === target)
	)
}

export function belongsToRelativeKey(chord: SuggestedChord, key: MusicalKey): boolean {
	return getRelativeKeys(key).some((relative) => isDiatonic(chord, relative))
}

/**
 * Scores every key by how many chords of the history are diatonic to it.
 * A forced key is lifted to at least 9 so it ranks first without hiding the others.
 */
export function computeKeyScores(
	history: Array<Pick<SuggestedChord, "rootPc" | "type">>,
	forcedKey?: string
): KeyScore[] {
	return KEYS.map((key) => {
		let score = history.filter((chord) => isDiatonic(chord, key)).length
		if (forcedKey === key.name) {
			score = Math.max(score, 9)
		}
		return { ...key, score }
	}).sort((a, b) => b.score - a.score)
}

/**
 * Splits the next-chord suggestions into diatonic, functional (secondary
 * dominants), related-key and chromatic groups for the given key.
 * Diatonic always lists all seven triads of the key.
 */
export function groupNextChords(chord: SuggestedChord, key: MusicalKey): GroupedSuggestions {
	const groups: GroupedSuggestions = {
		key,
		diatonic: diatonicChords(key).map((c) => ({ ...c, group: "diatonic" })),
		functional: [],
		relative: [],
		chromatic: []
	}
	for (const next of getNextChords(chord)) {
		if (isDiatonic(next, key)) {
			continue
		}
		const group: SuggestionGroup = isSecondaryDominant(next, key)
			? "functional"
			: belongsToRelativeKey(next, key)
				? "relative"
				: "chromatic"
		groups[group].push({ ...next, group })
	}
	return groups
}

/** The octave of a pitch class closest to the reference MIDI note */
export function snapToNearestOctave(targetPc: number, referenceMidi: number): number {
	const base = referenceMidi - mod12(referenceMidi) + mod12(targetPc)
	return [base - 12, base, base + 12].reduce((best, note) =>
		Math.abs(note - referenceMidi) < Math.abs(best - referenceMidi) ? note : best
	)
}

const average = (notes: number[]) => notes.reduce((a, b) => a + b, 0) / notes.length

/** Shifts the voicing by octaves until its average sits within a fourth of the centre */
export function adjustVoicingToCenter(notes: number[], center: number): number[] {
	let adjusted = notes.slice()
	while (average(adjusted) > center + 6) {
		adjusted = adjusted.map((note) => note - 12)
	}
	while (average(adjusted) < center - 6) {
		adjusted = adjusted.map((note) => note + 12)
	}
	return adjusted
}

/**
 * MIDI notes for a chord with each tone snapped near the player's centre.
 * Pass voicingCenter to keep successive chords around the first one played.
 */
export function voiceChord(
	rootPc: number,
	type: ChordType,
	center = 60,
	voicingCenter?: number
): number[] {
	const intervals = CHORD_TYPES[type]
	if (!intervals) {
		return [60 + mod12(rootPc)]
	}
	const notes = intervals.map((interval) => snapToNearestOctave(rootPc + interval, center))
	return voicingCenter === undefined ? notes : adjustVoicingToCenter(notes, voicingCenter)
}

/** A bass note for the pitch class near center + octaveOffset, never below C1 */
export function placeBassNote(pc: number, center = 60, octaveOffset = -24): number {
	return Math.max(24, snapToNearestOctave(pc, Math.round(center) + octaveOffset))
}

/**
 * A dominant seventh leading into the target: a semitone below for major
 * or minor, a tritone substitute for dom7, a semitone above for diminished.
 */
export function buildPassingChord(target: SuggestedChord): SuggestedChord {
	let rootPc = target.rootPc
	if (target.type === "major" || target.type === "minor") {
		rootPc = mod12(rootPc + 11)
	} else if (target.type === "dom7") {
		rootPc = mod12(rootPc + 6)
	} else if (target.type.includes("dim")) {
		rootPc = mod12(rootPc + 1)
	}
	return { rootPc, type: "dom7", label: chordToName({ rootPc, type: "dom7" }), octaveOffset: 60 }
}
