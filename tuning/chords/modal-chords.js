import { createChord } from './chords.js'
import { 
	IONIAN_INTERVALS,
	DORIAN_INTERVALS,
	PHRYGIAN_INTERVALS,
	LYDIAN_INTERVALS,
	MIXOLYDIAN_INTERVALS,
	AEOLIAN_INTERVALS,
	LOCRIAN_INTERVALS
} from '../intervals.js'

import {
	TUNING_MODE_IONIAN,
	TUNING_MODE_DORIAN,	
    TUNING_MODE_PHRYGIAN,
    TUNING_MODE_LYDIAN,	
    TUNING_MODE_MIXOLYDIAN,
    TUNING_MODE_AEOLIAN,
    TUNING_MODE_LOCRIAN
} from '../scales.ts'

export const TUNING_MODE_NAMES = [
	TUNING_MODE_IONIAN,			// Same as major
	TUNING_MODE_DORIAN,			// Start from second degree of major
	TUNING_MODE_PHRYGIAN,		// Start from third degree of major
	TUNING_MODE_LYDIAN,			// Start from fourth degree of major
	TUNING_MODE_MIXOLYDIAN,		// Start from fifth degree of major
	TUNING_MODE_AEOLIAN,		// Start from sixth degree (same as natural minor)
	TUNING_MODE_LOCRIAN			// Start from seventh degree
]

export const TUNING_MODES = {
	[TUNING_MODE_IONIAN]: IONIAN_INTERVALS,
	[TUNING_MODE_DORIAN]: DORIAN_INTERVALS,
	[TUNING_MODE_PHRYGIAN]: PHRYGIAN_INTERVALS,
	[TUNING_MODE_LYDIAN]: LYDIAN_INTERVALS,
	[TUNING_MODE_MIXOLYDIAN]: MIXOLYDIAN_INTERVALS,
	[TUNING_MODE_AEOLIAN]: AEOLIAN_INTERVALS,
	[TUNING_MODE_LOCRIAN]: LOCRIAN_INTERVALS
}

const TUNING_MODE_MAP = new Map()
TUNING_MODE_MAP.set( TUNING_MODE_IONIAN, IONIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_DORIAN, DORIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_PHRYGIAN,PHRYGIAN_INTERVALS  )
TUNING_MODE_MAP.set( TUNING_MODE_LYDIAN, LYDIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_MIXOLYDIAN, MIXOLYDIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_AEOLIAN, AEOLIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_LOCRIAN, LOCRIAN_INTERVALS )

TUNING_MODE_MAP.set( TUNING_MODE_IONIAN.toLowerCase(), IONIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_DORIAN.toLowerCase(), DORIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_PHRYGIAN.toLowerCase(),PHRYGIAN_INTERVALS  )
TUNING_MODE_MAP.set( TUNING_MODE_LYDIAN.toLowerCase(), LYDIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_MIXOLYDIAN.toLowerCase(), MIXOLYDIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_AEOLIAN.toLowerCase(), AEOLIAN_INTERVALS )
TUNING_MODE_MAP.set( TUNING_MODE_LOCRIAN.toLowerCase(), LOCRIAN_INTERVALS )

export const getIntervalFormulaForMode = (musicalMode) => {
	return TUNING_MODE_MAP.get(musicalMode) ?? []
}

export const getModeAsIntegerOffset = (mode) => isNaN(parseInt(mode)) ? TUNING_MODE_NAMES.indexOf(mode) : mode%TUNING_MODE_NAMES.length
export const getModeFromIntegerOffset = (mode) => isNaN(parseInt(mode)) ? mode : TUNING_MODE_NAMES[mode%TUNING_MODE_NAMES.length]
  
/**
 * Modal Chord Shortcuts
 * 
 * These handy shortcuts create chords based on the seven diatonic modes.
 * Each mode has a unique character and interval pattern, making them useful
 * for different musical contexts and emotional qualities.
 */

/**
 * Ionian Chord Shortcut (Major Scale Mode)
 * Intervals: [0, 2, 4, 5, 7, 9, 11]
 * Character: Bright, happy, optimistic; the most common major scale
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Ionian mode intervals
 * 
 * Usage: Perfect for major chords, pop, classical, uplifting compositions
 */
export const createIonianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, IONIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Dorian Chord Shortcut (2nd Mode)
 * Intervals: [0, 2, 3, 5, 7, 9, 10]
 * Character: Minor with brightness; sophisticated, cool, jazzy
 * Distinguished by the major 6th, giving it lift despite the flat 3rd
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Dorian mode intervals
 * 
 * Usage: Jazz, funk, modal rock, any minor context needing sophistication
 * Emotional: Contemplative, smooth, cool, approachable despite minor quality
 */
export const createDorianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, DORIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Phrygian Chord Shortcut (3rd Mode)
 * Intervals: [0, 1, 3, 5, 7, 8, 10]
 * Character: Dark, exotic, Spanish/flamenco flavor
 * The flat 2nd (half-step from root) creates distinctive tension and unease
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Phrygian mode intervals
 * 
 * Usage: Spanish music, flamenco, dark metal, world music, mysterious contexts
 * Emotional: Dark, exotic, mysterious, intense, passionate, foreign
 */
export const createPhrygianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, PHRYGIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Lydian Chord Shortcut (4th Mode)
 * Intervals: [0, 2, 4, 6, 7, 9, 11]
 * Character: Bright, ethereal, dreamy major variant
 * The raised 4th (augmented 4th) creates a "floating" sensation and whimsy
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Lydian mode intervals
 * 
 * Usage: Film scores, video game music, progressive rock, avant-garde, sci-fi
 * Emotional: Surreal, futuristic, enchanting, otherworldly, dreamy
 */
export const createLydianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, LYDIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Mixolydian Chord Shortcut (5th Mode)
 * Intervals: [0, 2, 4, 5, 7, 9, 10]
 * Character: Dominant 7th flavor, bluesy major
 * The flat 7th against the major triad creates natural forward motion
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Mixolydian mode intervals
 * 
 * Usage: Blues, rock, funk, soul, R&B, any context needing groove and edge
 * Emotional: Grooving, funky, soulful, slightly unresolved, swinging
 */
export const createMixolydianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, MIXOLYDIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Aeolian Chord Shortcut (6th Mode / Natural Minor)
 * Intervals: [0, 2, 3, 5, 7, 8, 10]
 * Character: Dark, sad, introspective minor
 * The most common minor scale in Western music with balanced melancholy
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Aeolian mode intervals
 * 
 * Usage: Rock ballads, sad songs, classical minor keys, metal, introspective pieces
 * Emotional: Melancholic, introspective, sad, serious, darker than Dorian
 */
export const createAeolianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, AEOLIAN_INTERVALS, offset, rotation, length, true, true )

/**
 * Locrian Chord Shortcut (7th Mode)
 * Intervals: [0, 1, 3, 5, 6, 8, 10]
 * Character: Darkest, most unstable mode; diminished quality
 * The flat 2nd and flat 5th create unease, making it rarely used as standalone scale
 * 
 * @param {Array<Number>} notes Full keyboard note array
 * @param {Number} offset Starting note index (default: 0)
 * @param {Number} mode Scale degree offset (default: 0)
 * @returns {Array<Number>} Chord notes selected from the Locrian mode intervals
 * 
 * Usage: Atonal music, tension moments, experimental/avant-garde, rarely as tonal center
 * Emotional: Tense, unstable, diminished, dark, ominous, unresolved
 * 
 * Note: Locrian is typically used for passing tones rather than as a primary tonal center
 */
export const createLocrianChord = ( notes, offset=0, rotation=0, length=-1 ) => createChord( notes, LOCRIAN_INTERVALS, offset, rotation, length, true, true )