/**
 * Voicings and chromatic interval sets used to colour a chord by emotion.
 * All values are absolute semitone offsets from the root. Sets that audiobus
 * already defines in intervals.ts are referenced from the library maps rather
 * than repeated here.
 */
import {
	AUGMENTED_CHORD_INTERVALS,
	DIMINISHED_CHORD_INTERVALS,
	DIMINISHED_SEVENTH_CHORD_INTERVALS,
	DOMINANT_NINTH_CHORD_INTERVALS,
	DOMINANT_SEVENTH_CHORD_INTERVALS,
	HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS,
	ADD6_CHORD_INTERVALS,
	MAJOR_CHORD_INTERVALS,
	MAJOR_NINTH_CHORD_INTERVALS,
	MAJOR_SEVENTH_CHORD_INTERVALS,
	MINOR_ADD6_CHORD_INTERVALS,
	MINOR_CHORD_INTERVALS,
	MINOR_MAJOR_SEVENTH_CHORD_INTERVALS,
	MINOR_NINTH_CHORD_INTERVALS,
	MINOR_SEVENTH_CHORD_INTERVALS,
	POWER_CHORD_EXTENDED_INTERVALS,
	POWER_CHORD_INTERVALS,
	SUSPENDED_2_CHORD_INTERVALS,
	SUSPENDED_4_CHORD_INTERVALS
} from "./intervals.ts"

export type IntervalSet = readonly number[]

const set = (...intervals: number[]): IntervalSet => Object.freeze(intervals)

// Voicings audiobus did not have under any name

/** Dominant seventh suspended fourth, 1-4-5-b7. */
export const SUSPENDED_7_VOICING_INTERVALS = set(0, 5, 7, 10)
/** Major six-nine, 1-3-5-6-9. */
export const SIXTH_9_VOICING_INTERVALS = set(0, 4, 7, 9, 14)
/** Minor six-nine, 1-b3-5-6-9. */
export const MINOR_6TH_9_VOICING_INTERVALS = set(0, 3, 7, 9, 14)
/** Radiant major eleventh, 1-3-5-7-9-#11: joyful, Lydian extension. */
export const RADIANT_MAJOR_11_VOICING_INTERVALS = set(0, 4, 7, 11, 14, 18)
/** Ecstatic major thirteenth, 1-3-5-7-9-#11-13: the widest smiling expression. */
export const ECSTATIC_MAJOR_13_VOICING_INTERVALS = set(0, 4, 7, 11, 14, 18, 21)
/** Weeping minor eleventh, 1-b3-5-b7-9-11: deeply sad and spacious. */
export const WEEPING_MINOR_11_VOICING_INTERVALS = set(0, 3, 7, 10, 14, 17)
/** Desolate minor-major thirteenth, 1-b3-5-7-9-11-13: anguished. */
export const DESOLATE_MINOR_MAJOR_13_VOICING_INTERVALS = set(0, 3, 7, 11, 14, 17, 21)

// Chromatic sets audiobus did not have under any name

/** Chromatic rest, 1: the root alone. */
export const CHROMATIC_REST_INTERVALS = set(0)
/** Chromatic Lydian glow, 1-3-#4-5. */
export const CHROMATIC_LYDIAN_GLOW_INTERVALS = set(0, 4, 6, 7)
/** Chromatic Phrygian colour, 1-b2-b3-5. */
export const CHROMATIC_PHRYGIAN_INTERVALS = set(0, 1, 3, 7)
/** Chromatic question, 1-b2-4. */
export const CHROMATIC_QUESTION_INTERVALS = set(0, 1, 5)
/** Chromatic cluster, 1-b2-2. */
export const CHROMATIC_CLUSTER_INTERVALS = set(0, 1, 2)
/** Chromatic wide cluster, 1-b2-5-b7. */
export const CHROMATIC_WIDE_CLUSTER_INTERVALS = set(0, 1, 7, 10)
/** Chromatic tritone tension, 1-b5-5. */
export const CHROMATIC_TRITONE_TENSION_INTERVALS = set(0, 6, 7)
/** Chromatic alarm, 1-b2-b5-b9. */
export const CHROMATIC_ALARM_INTERVALS = set(0, 1, 6, 13)
/** Chromatic whole-tone colour, 1-2-3-#4. */
export const CHROMATIC_WHOLE_TONE_COLOUR_INTERVALS = set(0, 2, 4, 6)
/** Chromatic dream chord, 1-3-b7. */
export const CHROMATIC_DREAM_INTERVALS = set(0, 4, 10)
/** Chromatic low hollow chord, 1-4. */
export const CHROMATIC_LOW_HOLLOW_INTERVALS = set(0, 5)
/** Chromatic blues colour, 1-b3-b5-5 (a chord, unlike BLUES_SCALE_INTERVALS). */
export const CHROMATIC_BLUES_INTERVALS = set(0, 3, 6, 7)
/** Chromatic comic chord, 1-2-5-6. */
export const CHROMATIC_COMIC_INTERVALS = set(0, 2, 7, 9)
/** Chromatic alien chord, 1-b2-4-b7. */
export const CHROMATIC_ALIEN_INTERVALS = set(0, 1, 5, 10)
/** Chromatic dark-heart chord, 1-b2-4-5. */
export const CHROMATIC_DARK_HEART_INTERVALS = set(0, 1, 5, 7)

/**
 * Same keys as PhotoSYNTH's CHORD_VOICING_INTERVAL_LIBRARY. Entries that point at
 * intervals.ts constants are aliases of sets audiobus already had.
 */
export const CHORD_VOICING_INTERVAL_LIBRARY = Object.freeze({
	major: MAJOR_CHORD_INTERVALS,
	minor: MINOR_CHORD_INTERVALS,
	suspended: SUSPENDED_4_CHORD_INTERVALS,
	suspended2: SUSPENDED_2_CHORD_INTERVALS,
	diminished: DIMINISHED_CHORD_INTERVALS,
	augmented: AUGMENTED_CHORD_INTERVALS,
	major6: ADD6_CHORD_INTERVALS,
	minor6: MINOR_ADD6_CHORD_INTERVALS,
	major7: MAJOR_SEVENTH_CHORD_INTERVALS,
	minor7: MINOR_SEVENTH_CHORD_INTERVALS,
	dominant7: DOMINANT_SEVENTH_CHORD_INTERVALS,
	minorMajor7: MINOR_MAJOR_SEVENTH_CHORD_INTERVALS,
	diminished7: DIMINISHED_SEVENTH_CHORD_INTERVALS,
	halfDiminished: HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS,
	suspended7: SUSPENDED_7_VOICING_INTERVALS,
	major9: MAJOR_NINTH_CHORD_INTERVALS,
	minor9: MINOR_NINTH_CHORD_INTERVALS,
	dominant9: DOMINANT_NINTH_CHORD_INTERVALS,
	sixth9: SIXTH_9_VOICING_INTERVALS,
	minor6th9: MINOR_6TH_9_VOICING_INTERVALS,
	radiantMajor11: RADIANT_MAJOR_11_VOICING_INTERVALS,
	ecstaticMajor13: ECSTATIC_MAJOR_13_VOICING_INTERVALS,
	weepingMinor11: WEEPING_MINOR_11_VOICING_INTERVALS,
	desolateMinorMajor13: DESOLATE_MINOR_MAJOR_13_VOICING_INTERVALS
} satisfies Record<string, IntervalSet>)

export type ChordVoicingName = keyof typeof CHORD_VOICING_INTERVAL_LIBRARY

/** Every PhotoSYNTH CHROMATIC_* set by short name (aliases where audiobus had the same intervals). */
export const CHROMATIC_INTERVAL_LIBRARY = Object.freeze({
	rest: CHROMATIC_REST_INTERVALS,
	unisonFifth: POWER_CHORD_INTERVALS,
	majorTriad: MAJOR_CHORD_INTERVALS,
	minorTriad: MINOR_CHORD_INTERVALS,
	diminishedTriad: DIMINISHED_CHORD_INTERVALS,
	sus2: SUSPENDED_2_CHORD_INTERVALS,
	sus4: SUSPENDED_4_CHORD_INTERVALS,
	majorSixth: ADD6_CHORD_INTERVALS,
	majorSeventh: MAJOR_SEVENTH_CHORD_INTERVALS,
	minorSeventh: MINOR_SEVENTH_CHORD_INTERVALS,
	ninth: DOMINANT_NINTH_CHORD_INTERVALS,
	lydianGlow: CHROMATIC_LYDIAN_GLOW_INTERVALS,
	phrygian: CHROMATIC_PHRYGIAN_INTERVALS,
	question: CHROMATIC_QUESTION_INTERVALS,
	cluster: CHROMATIC_CLUSTER_INTERVALS,
	wideCluster: CHROMATIC_WIDE_CLUSTER_INTERVALS,
	tritoneTension: CHROMATIC_TRITONE_TENSION_INTERVALS,
	alarm: CHROMATIC_ALARM_INTERVALS,
	wholeToneColour: CHROMATIC_WHOLE_TONE_COLOUR_INTERVALS,
	augmented: AUGMENTED_CHORD_INTERVALS,
	dream: CHROMATIC_DREAM_INTERVALS,
	sleep: POWER_CHORD_EXTENDED_INTERVALS,
	hollow: POWER_CHORD_INTERVALS,
	lowHollow: CHROMATIC_LOW_HOLLOW_INTERVALS,
	blues: CHROMATIC_BLUES_INTERVALS,
	comic: CHROMATIC_COMIC_INTERVALS,
	alien: CHROMATIC_ALIEN_INTERVALS,
	coolHeart: SUSPENDED_7_VOICING_INTERVALS,
	darkHeart: CHROMATIC_DARK_HEART_INTERVALS
} satisfies Record<string, IntervalSet>)

export type ChromaticIntervalName = keyof typeof CHROMATIC_INTERVAL_LIBRARY