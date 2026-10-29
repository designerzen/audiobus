/**
 * Tuning & Music Theory
 * Scales, intervals, chords, and harmonic analysis
 */

export * from "pitfalls"
export {
	describeChord,
	precacheChordDescriptions,
	convertToIntervalArray,
	describeMusicalMode
} from "./chords/describe-chord.ts"
export type { ChordDescription } from "./chords/describe-chord.ts"