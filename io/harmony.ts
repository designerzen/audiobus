import { mapPitchSet, mod12, pitchClasses, pitchSetMask } from "../tuning/pitch-class-set"
import {
	CHROMATIC_SCALE,
	HARMONY_MODE_FREE_RANGE,
	MAJOR_SCALE,
	SCALE_FORMULA_LIBRARY,
	getPitchClassForKey,
	getScaleFormula,
	isChromaticScale,
	normaliseKeyName,
	type KeyInput,
	type ScaleFormula
} from "../tuning/keys.ts"

/** Masks are absolute pitch classes (bit 0 = C), independent of the tonic. */
export interface HarmonicState {
	root: number
	scale: number
	chord: number
	/** Optional slash-chord bass pitch class (0-11), e.g. from MIDI 2.0 Flex Data Set Chord Name. */
	bass?: number
}
export interface HarmonicSection extends HarmonicState {
	id: string
	name: string
	beats: number
	x: number
	y: number
}
export const DEFAULT_HARMONY: HarmonicState = { root: 0, scale: 2741, chord: 145 }
export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
export const SCALE_FAMILIES = [
	{ name: "Major", mask: 2741 },
	{ name: "Natural minor", mask: 1453 },
	{ name: "Harmonic minor", mask: 2477 },
	{ name: "Melodic minor", mask: 2733 },
	{ name: "Dorian", mask: 1709 },
	{ name: "Mixolydian", mask: 1717 },
	{ name: "Major pentatonic", mask: 661 },
	{ name: "Minor pentatonic", mask: 1193 },
	{ name: "Whole tone", mask: 1365 }
]
export function parseHarmony(value: unknown): HarmonicState {
	const state = value as HarmonicState
	if (!state || !Number.isInteger(state.root) || state.root < 0 || state.root > 11) {
		throw new Error("Harmony needs a tonic from 0 to 11")
	}
	const parsed: HarmonicState = {
		root: state.root,
		scale: pitchSetMask(state.scale),
		chord: pitchSetMask(state.chord)
	}
	if (state.bass !== undefined) {
		if (!Number.isInteger(state.bass) || state.bass < 0 || state.bass > 11) {
			throw new Error("Harmony bass must be a pitch class from 0 to 11")
		}
		parsed.bass = state.bass
	}
	return parsed
}
export function parseSections(value: unknown): HarmonicSection[] {
	if (!Array.isArray(value) || value.length > 128) {
		throw new Error("Maximum 128 song sections")
	}
	const ids = new Set<string>()
	return value.map((section) => {
		if (
			!section ||
			typeof section.id !== "string" ||
			!section.id ||
			section.id.length > 80 ||
			ids.has(section.id) ||
			typeof section.name !== "string" ||
			section.name.length > 80 ||
			!Number.isFinite(section.beats) ||
			section.beats < 0.25 ||
			section.beats > 256 ||
			![section.x, section.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
		) {
			throw new Error("Invalid harmonic section")
		}
		ids.add(section.id)
		return {
			...parseHarmony(section),
			id: section.id,
			name: section.name,
			beats: section.beats,
			x: section.x,
			y: section.y
		}
	})
}
export function sectionAt(sections: HarmonicSection[], beat: number): HarmonicSection | undefined {
	const length = sections.reduce((sum, section) => sum + section.beats, 0)
	if (!length || !Number.isFinite(beat)) {
		return
	}
	let position = ((beat % length) + length) % length
	for (const section of sections) {
		if (position < section.beats) {
			return section
		}
		position -= section.beats
	}
}
export function sameHarmony(a: HarmonicState, b: HarmonicState): boolean {
	return a.root === b.root && a.scale === b.scale && a.chord === b.chord && a.bass === b.bass
}
export function scaleNeighbours(state: HarmonicState) {
	return SCALE_FAMILIES.flatMap((family) =>
		NOTE_NAMES.map((tonic, root) => {
			const scale = mapPitchSet(family.mask, 1, root)
			return {
				root,
				scale,
				name: `${tonic} ${family.name}`,
				distance: pitchClasses(scale ^ state.scale).length
			}
		})
	).sort((a, b) => a.distance - b.distance || a.root - b.root)
}
export interface HarmonyCandidate extends HarmonicState {
	name: string
	score: number
	coverage: number
}
/** Weighted pitch-class evidence; alternatives deliberately remain visible to the player. */
export function inferHarmony(
	notes: Array<{ number: number; velocity?: number }>
): HarmonyCandidate[] {
	const histogram = Array<number>(12).fill(0)
	for (const note of notes) {
		if (Number.isInteger(note.number) && note.number >= 0 && note.number <= 127) {
			histogram[mod12(note.number)] += Math.max(1, Math.min(127, note.velocity ?? 80))
		}
	}
	const total = histogram.reduce((sum, weight) => sum + weight, 0)
	if (!total) {
		return []
	}
	const played = histogram.reduce(
		(mask, weight, pitch) => (weight ? mask | (1 << pitch) : mask),
		0
	)
	return SCALE_FAMILIES.flatMap((family) =>
		NOTE_NAMES.map((tonic, root) => {
			const scale = mapPitchSet(family.mask, 1, root)
			const inside = histogram.reduce(
				(sum, weight, pitch) => sum + (scale & (1 << pitch) ? weight : 0),
				0
			)
			const triads = [145, 137, 73, 161].flatMap((mask) =>
				NOTE_NAMES.map((_, r) => mapPitchSet(mask, 1, r))
			)
			const chord =
				triads
					.filter((mask) => (mask & scale) === mask)
					.sort((a, b) => {
						const score = (mask: number) =>
							histogram.reduce((s, w, p) => s + (mask & (1 << p) ? w : 0), 0)
						return score(b) - score(a)
					})[0] ?? played
			const coverage = inside / total
			return {
				root,
				scale,
				chord,
				name: `${tonic} ${family.name}`,
				coverage,
				score:
					coverage * 100 -
					pitchClasses(scale & ~played).length * 1.5 +
					(histogram[root] / total) * 3
			}
		})
	)
		.sort((a, b) => b.score - a.score)
		.slice(0, 8)
}

export const STRING_TUNINGS = {
	Guitar: [40, 45, 50, 55, 59, 64],
	Bass: [28, 33, 38, 43],
	Mandolin: [55, 62, 69, 76]
} as const
export function fretboard(tuning: readonly number[], mask: number, frets = 12) {
	return tuning.map((open) =>
		Array.from({ length: frets + 1 }, (_, fret) => ({
			fret,
			note: open + fret,
			active: Boolean(mask & (1 << mod12(open + fret)))
		}))
	)
}
/** Find playable simultaneous chord positions without assigning two notes to one string. */
export function chordTab(
	tuning: readonly number[],
	mask: number,
	start = 0,
	span = 4
): Array<number | null> {
	let best: { frets: Array<number | null>; score: number } | undefined
	const visit = (string: number, frets: Array<number | null>, covered: number, cost: number) => {
		if (string === tuning.length) {
			const score = pitchClasses(mask & ~covered).length * 100 + cost
			if (!best || score < best.score) {
				best = { frets: [...frets], score }
			}
			return
		}
		const choices: Array<number | null> = [
			null,
			...Array.from({ length: span + 1 }, (_, i) => start + i).filter(
				(fret) => mask & (1 << mod12(tuning[string] + fret))
			)
		]
		for (const fret of choices) {
			visit(
				string + 1,
				[...frets, fret],
				covered | (fret === null ? 0 : 1 << mod12(tuning[string] + fret)),
				cost + (fret === null ? 5 : fret * 0.1)
			)
		}
	}
	visit(0, [], 0, 0)
	return best?.frets ?? tuning.map(() => null)
}

/** A PhotoSYNTH-style shared key: a tonic plus a scale formula. Free range is the whole chromatic scale. */
export interface HarmonyKey {
	/** Note name such as "Bb", or "free-range" */
	tonic: string
	/** Pitch class 0-11 (0 when free range) */
	root: number
	/** Ascending semitone offsets from the tonic */
	scale: number[]
	/** Name from SCALE_FORMULA_LIBRARY, e.g. "MAJOR_SCALE", when the scale matches one */
	scaleName?: string
	freeRange: boolean
}

const chordMaskFor = (root: number, formula: readonly number[]) => {
	const third = [4, 3].find((interval) => formula.includes(interval))
	const fifth = [7, 6, 8].find((interval) => formula.includes(interval))
	return [0, third, fifth].reduce<number>(
		(mask, interval) => (interval === undefined ? mask : mask | (1 << mod12(root + interval))),
		0
	)
}

/**
 * Build the shared harmony for a key. "free-range" (or any chromatic scale) allows every
 * pitch class. The chord defaults to the tonic triad that the scale supports.
 */
export function harmonyFromKey(
	tonic: KeyInput = 0,
	scale: ScaleFormula | string = MAJOR_SCALE,
	chord?: number
): HarmonicState {
	const freeRange = tonic === HARMONY_MODE_FREE_RANGE
	const root = freeRange ? 0 : getPitchClassForKey(tonic)
	const formula = freeRange ? CHROMATIC_SCALE : getScaleFormula(scale)
	const mask = formula.reduce((result, interval) => result | (1 << mod12(root + interval)), 0)
	return {
		root,
		scale: mask,
		chord: chord === undefined ? chordMaskFor(root, formula) : pitchSetMask(chord)
	}
}

/** Inverse of harmonyFromKey. A scale holding all twelve pitch classes reads as free range. */
export function keyFromHarmony(state: HarmonicState): HarmonyKey {
	const scale = pitchClasses(state.scale)
		.map((pitch) => mod12(pitch - state.root))
		.sort((a, b) => a - b)
	const freeRange = isChromaticScale(scale)
	const scaleName = Object.entries(SCALE_FORMULA_LIBRARY).find(
		([, formula]) => formula.length === scale.length && formula.every((v, i) => v === scale[i])
	)?.[0]
	return {
		tonic: freeRange ? HARMONY_MODE_FREE_RANGE : normaliseKeyName(state.root),
		root: freeRange ? 0 : state.root,
		scale,
		scaleName,
		freeRange
	}
}

/**
 * Move a MIDI note (0-127) to the nearest pitch class in the harmony's scale.
 * Notes already in the scale are unchanged; ties go to the lower note.
 */
export function constrainNoteToHarmony(note: number, state: HarmonicState): number {
	if (!state.scale) {
		return note
	}
	for (let distance = 0; distance < 12; distance++) {
		for (const candidate of [note - distance, note + distance]) {
			if (candidate >= 0 && candidate <= 127 && state.scale & (1 << mod12(candidate))) {
				return candidate
			}
		}
	}
	return note
}