/**
 * Chord and key estimation from 12-bin chroma (bin 0 = C).
 * Kept free of Essentia so the live chord follower can run on the main thread.
 */
import type { ScaleName } from "./essentia-features.ts"

export interface ChordEstimate {
	root: number
	quality: ScaleName
	/** Cosine similarity with the triad template, 0–1. */
	score: number
}

export interface KeyEstimate {
	root: number
	scale: ScaleName
	/** Correlation with the key profile, -1–1. */
	score: number
}

// Krumhansl–Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const TRIADS: Record<ScaleName, number[]> = { major: [0, 4, 7], minor: [0, 3, 7] }

export function chordNotes(chord: Pick<ChordEstimate, "root" | "quality">): number[] {
	return TRIADS[chord.quality].map((interval) => (chord.root + interval) % 12)
}

/** Best-matching major or minor triad, or undefined for silence. */
export function matchChord(chroma: ArrayLike<number>): ChordEstimate | undefined {
	const energy = Math.hypot(...Array.from(chroma))
	if (!(energy > 0)) {
		return
	}
	let best: ChordEstimate | undefined
	for (const quality of ["major", "minor"] as const) {
		for (let root = 0; root < 12; root++) {
			let dot = 0
			for (const interval of TRIADS[quality]) {
				dot += chroma[(root + interval) % 12]
			}
			const score = dot / (energy * Math.sqrt(3))
			if (!best || score > best.score) {
				best = { root, quality, score }
			}
		}
	}
	return best
}

function correlation(a: ArrayLike<number>, b: number[], shift: number): number {
	let meanA = 0
	let meanB = 0
	for (let i = 0; i < 12; i++) {
		meanA += a[i] / 12
		meanB += b[i] / 12
	}
	let numerator = 0
	let varianceA = 0
	let varianceB = 0
	for (let i = 0; i < 12; i++) {
		const x = a[(i + shift) % 12] - meanA
		const y = b[i] - meanB
		numerator += x * y
		varianceA += x * x
		varianceB += y * y
	}
	const denominator = Math.sqrt(varianceA * varianceB)
	return denominator > 0 ? numerator / denominator : 0
}

/** Key from accumulated chroma using Krumhansl–Kessler profiles. */
export function estimateKey(chroma: ArrayLike<number>): KeyEstimate | undefined {
	let best: KeyEstimate | undefined
	for (const [scale, profile] of [
		["major", MAJOR_PROFILE],
		["minor", MINOR_PROFILE]
	] as const) {
		for (let root = 0; root < 12; root++) {
			const score = correlation(chroma, profile, root)
			if (!best || score > best.score) {
				best = { root, scale, score }
			}
		}
	}
	return best && best.score > 0 ? best : undefined
}