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
export * from "./chord-suggestions.ts"
export * from "./emotional-intervals.ts"
export * from "./keys.ts"
export * from "./emotion-chords.ts"