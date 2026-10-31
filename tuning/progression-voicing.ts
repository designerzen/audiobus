import { mod12 } from "./pitch-class-set"
import { SATB_RANGES } from "./classical-voice-leading"
import type { TheoryChord } from "./classical-progressions"

export type ProgressionVoicing = "smooth" | "close" | "classical"
/** Bounded beam search: retain all chord tones and the notated bass/inversion. */
export function voiceProgressionChord(
	chord: TheoryChord,
	previous: number[],
	lower: number,
	upper: number,
	style: ProgressionVoicing
): number[] {
	const low = Math.max(0, Math.min(lower, upper)),
		high = Math.min(127, Math.max(lower, upper))
	if (!chord.pcs.length || chord.pcs.length > 4) return []
	const count =
		style === "classical"
			? 4
			: chord.pcs.length === 1
				? 1
				: Math.max(chord.pcs.length, Math.min(previous.length || 3, 4))
	const candidates = Array.from({ length: 128 }, (_, pitch) => pitch).filter(
		(pitch) => pitch >= low && pitch <= high && chord.pcs.includes(mod12(pitch))
	)
	interface Path {
		notes: number[]
		cost: number
		mask: number
	}
	let paths: Path[] = [{ notes: [], cost: 0, mask: 0 }]
	const required = chord.pcs.reduce((mask, pc) => mask | (1 << pc), 0)
	for (let part = 0; part < count; part++) {
		const next = new Map<string, Path>()
		for (const path of paths)
			for (const pitch of candidates) {
				if (part === 0 && mod12(pitch) !== chord.bass) continue
				if (
					part &&
					(pitch <= path.notes[part - 1] ||
						pitch - path.notes[part - 1] > (part === 1 ? 19 : 12))
				)
					continue
				if (style === "classical") {
					if (pitch < SATB_RANGES[part][0] || pitch > SATB_RANGES[part][1]) continue
					if (previous.length === 4) {
						if (
							(part && pitch < previous[part - 1]) ||
							(part < 3 && pitch > previous[part + 1])
						)
							continue
						if (
							mod12(previous[part]) === mod12(chord.root - 1) &&
							pitch !== previous[part] &&
							pitch !== previous[part] + 1
						)
							continue
						if (
							path.notes.some((note, j) => {
								const before = mod12(previous[part] - previous[j]),
									after = mod12(pitch - note)
								return (
									(before === 0 || before === 7) &&
									before === after &&
									Math.sign(pitch - previous[part]) !== 0 &&
									Math.sign(pitch - previous[part]) ===
										Math.sign(note - previous[j])
								)
							})
						)
							continue
					}
				}
				const mask = path.mask | (1 << mod12(pitch))
				const missing = chord.pcs.filter((pc) => !(mask & (1 << pc))).length
				if (missing > count - part - 1) continue
				const target = previous[part] ?? [48, 55, 64, 72][part]
				const cost =
					path.cost +
					Math.abs(pitch - target) +
					(style === "close" && part ? (pitch - path.notes[0]) * 0.3 : 0)
				const key = `${pitch}:${mask}`
				if (!next.has(key) || next.get(key)!.cost > cost)
					next.set(key, { notes: [...path.notes, pitch], cost, mask })
			}
		paths = [...next.values()].sort((a, b) => a.cost - b.cost).slice(0, 256)
	}
	return paths.find((path) => (path.mask & required) === required)?.notes ?? []
}

export interface SoundingStep {
	notes: number[]
	label: string
	beats: number
	root: number
}
export function voiceTheoryPath(
	chords: TheoryChord[],
	previous: number[],
	lower: number,
	upper: number,
	style: ProgressionVoicing
): SoundingStep[] {
	const result: SoundingStep[] = []
	let notes = previous
	for (const chord of chords) {
		notes = voiceProgressionChord(chord, notes, lower, upper, style)
		if (!notes.length) return []
		result.push({ notes, label: chord.label, beats: chord.beats, root: chord.root })
	}
	return result
}