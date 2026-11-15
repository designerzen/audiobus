/**
 * Global key helpers: a key is a tonic plus a scale formula. "Free range" is
 * the chromatic scale, which does not restrict any pitch class.
 */
import {
	AEOLIAN_INTERVALS,
	BLUES_SCALE_INTERVALS,
	DORIAN_INTERVALS,
	IONIAN_INTERVALS,
	LOCRIAN_INTERVALS,
	LYDIAN_INTERVALS,
	MAJOR_PENTATONIC_INTERVALS,
	MINOR_PENTATONIC_INTERVALS,
	MIXOLYDIAN_INTERVALS,
	PHRYGIAN_INTERVALS
} from "./intervals.ts"

export const HARMONY_MODE_GLOBAL_KEY = "global-key"
export const HARMONY_MODE_FREE_RANGE = "free-range"
export type HarmonyMode = typeof HARMONY_MODE_GLOBAL_KEY | typeof HARMONY_MODE_FREE_RANGE

/** Semitone offsets from the tonic. */
export type ScaleFormula = readonly number[]

export const CHROMATIC_SCALE: ScaleFormula = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
export const MAJOR_SCALE: ScaleFormula = IONIAN_INTERVALS
export const NATURAL_MINOR_SCALE: ScaleFormula = AEOLIAN_INTERVALS
export const HARMONIC_MINOR_SCALE: ScaleFormula = [0, 2, 3, 5, 7, 8, 11]
export const MELODIC_MINOR_SCALE: ScaleFormula = [0, 2, 3, 5, 7, 9, 11]
export const DORIAN_SCALE: ScaleFormula = DORIAN_INTERVALS
export const PHRYGIAN_SCALE: ScaleFormula = PHRYGIAN_INTERVALS
export const LYDIAN_SCALE: ScaleFormula = LYDIAN_INTERVALS
export const MIXOLYDIAN_SCALE: ScaleFormula = MIXOLYDIAN_INTERVALS
export const LOCRIAN_SCALE: ScaleFormula = LOCRIAN_INTERVALS
export const PENTATONIC_MAJOR_SCALE: ScaleFormula = MAJOR_PENTATONIC_INTERVALS
export const PENTATONIC_MINOR_SCALE: ScaleFormula = MINOR_PENTATONIC_INTERVALS
export const BLUES_SCALE: ScaleFormula = BLUES_SCALE_INTERVALS
export const WHOLE_TONE_SCALE: ScaleFormula = [0, 2, 4, 6, 8, 10]
export const DIMINISHED_SCALE: ScaleFormula = [0, 2, 3, 5, 6, 8, 9, 11]
export const AUGMENTED_SCALE: ScaleFormula = [0, 3, 4, 7, 8, 11]
/** An ordering by perfect fifths rather than a playable scale. */
export const FIFTHS_SCALE: ScaleFormula = [9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2]

/** Same names as PhotoSYNTH's SCALE_INTERVAL_LIBRARY. */
export const SCALE_FORMULA_LIBRARY: Readonly<Record<string, ScaleFormula>> = Object.freeze({
	CHROMATIC_SCALE,
	MAJOR_SCALE,
	NATURAL_MINOR_SCALE,
	HARMONIC_MINOR_SCALE,
	MELODIC_MINOR_SCALE,
	DORIAN_SCALE,
	PHRYGIAN_SCALE,
	LYDIAN_SCALE,
	MIXOLYDIAN_SCALE,
	LOCRIAN_SCALE,
	PENTATONIC_MAJOR_SCALE,
	PENTATONIC_MINOR_SCALE,
	BLUES_SCALE,
	WHOLE_TONE_SCALE,
	DIMINISHED_SCALE,
	AUGMENTED_SCALE,
	FIFTHS_SCALE,
	FIFTHS: FIFTHS_SCALE
})

const PITCH_CLASS_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

const PITCH_CLASS_BY_NAME = new Map<string, number>([
	["C", 0],
	["B#", 0],
	["C#", 1],
	["Db", 1],
	["D", 2],
	["D#", 3],
	["Eb", 3],
	["E", 4],
	["Fb", 4],
	["E#", 5],
	["F", 5],
	["F#", 6],
	["Gb", 6],
	["G", 7],
	["G#", 8],
	["Ab", 8],
	["A", 9],
	["A#", 10],
	["Bb", 10],
	["B", 11],
	["Cb", 11]
])

export type KeyInput = number | string

const isNumericKey = (key: KeyInput) => !Number.isNaN(Number(key))
const wrapPitchClass = (key: KeyInput) => ((Number.parseInt(String(key)) % 12) + 12) % 12

/** 10 -> "Bb", "f#4" -> "F#", anything unrecognised -> "C" */
export const normaliseKeyName = (key: KeyInput = 0): string => {
	if (isNumericKey(key)) {
		return PITCH_CLASS_NAMES[wrapPitchClass(key)]
	}
	const match = String(key).match(/^([A-Ga-g](?:#|b)?)/)
	return match ? `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}` : "C"
}

/** "Db" or "C#4" -> 1; numbers wrap into 0-11 */
export const getPitchClassForKey = (key: KeyInput = 0): number => {
	if (isNumericKey(key)) {
		return wrapPitchClass(key)
	}
	return PITCH_CLASS_BY_NAME.get(normaliseKeyName(key)) ?? 0
}

/** Arrays pass through; names resolve with or without the _SCALE suffix; unknown names give major. */
export const getScaleFormula = (scale: ScaleFormula | string = MAJOR_SCALE): ScaleFormula => {
	if (Array.isArray(scale)) {
		return scale
	}
	const scaleName = String(scale || "MAJOR_SCALE").toUpperCase()
	return (
		SCALE_FORMULA_LIBRARY[scaleName] ??
		SCALE_FORMULA_LIBRARY[`${scaleName}_SCALE`] ??
		MAJOR_SCALE
	)
}

export const getKeyScaleNotes = (
	key: KeyInput = 0,
	scale: ScaleFormula | string = MAJOR_SCALE
): string[] => {
	const root = getPitchClassForKey(key)
	return getScaleFormula(scale).map(
		(interval) => PITCH_CLASS_NAMES[(root + interval) % PITCH_CLASS_NAMES.length]
	)
}

/** True when the formula admits every pitch class (free range). */
export const isChromaticScale = (scale: ScaleFormula) =>
	scale.length === 12 && scale.every((interval, index) => interval === index)