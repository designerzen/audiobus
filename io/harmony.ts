import { mapPitchSet, mod12, pitchClasses, pitchSetMask } from "../tuning/pitch-class-set"

/** Masks are absolute pitch classes (bit 0 = C), independent of the tonic. */
export interface HarmonicState {
	root: number
	scale: number
	chord: number
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
	return { root: state.root, scale: pitchSetMask(state.scale), chord: pitchSetMask(state.chord) }
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
	return a.root === b.root && a.scale === b.scale && a.chord === b.chord
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