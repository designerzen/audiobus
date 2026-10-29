
/**
 * Most scales, except the blues scale, have seven steps, 
 * while pentatonic scales have five steps.
 * there are different scales with custom tunings
 * out there but these are the classics
 * 
 * Dorian sounds brighter than Aeolian, 
 * but Phrygian and especially Locrian 
 * have a much darker sound 
 */

const rotateArray = (a, n) => {
    n = n % a.length
    return a.slice(n, a.length).concat(a.slice(0, n))
}

export const TUNING_MODE_IONIAN = 'Ionian'
export const TUNING_MODE_DORIAN = 'Dorian'
export const TUNING_MODE_PHRYGIAN = 'Phrygian'
export const TUNING_MODE_LYDIAN = 'Lydian'			// Harmonic Minor
export const TUNING_MODE_MIXOLYDIAN = 'Mixolydian'	// Melodic Minor
export const TUNING_MODE_AEOLIAN = 'Aeolian'
export const TUNING_MODE_LOCRIAN = 'Locrian'

export const TUNING_MODE_NAMES = [
	TUNING_MODE_IONIAN,			// Same as major
	TUNING_MODE_DORIAN,			// * Start from second degree of major
	TUNING_MODE_PHRYGIAN,		// * Start from third degree of major
	TUNING_MODE_LYDIAN,			// Start from fourth degree of major
	TUNING_MODE_MIXOLYDIAN,		// Start from fifth degree of major
	TUNING_MODE_AEOLIAN,		// * Start from sixth degree (same as natural minor)
	TUNING_MODE_LOCRIAN			// * Start from seventh degree
]

export const getModeAsIntegerOffset = (mode) => isNaN(parseInt(mode)) ? TUNING_MODE_NAMES.indexOf(mode) : mode%TUNING_MODE_NAMES.length
export const getModeFromIntegerOffset = (mode) => isNaN(parseInt(mode)) ? mode : TUNING_MODE_NAMES[mode%TUNING_MODE_NAMES.length]
  
// Shifted intervals...
// To go from any specific note to any other specific note
const TRANSPOSE_INTERVAL = {
	downOctave: -12,
	minorSecond: 1,
	majorSecond: 2,
	minorThird: 3,
	majorThird: 4,
	perfectFourth: 5,
	diminishedFifth: 6,
	perfectFifth: 7,
	minorSixth: 8,
	majorSixth: 9,
	minorSeventh: 10,
	majorSeventh: 11,
	perfectOctave: 12,
	upOctave: 12
}

/**
 * Intervals: 1, 2, 3, 4, 5, 6, 7
 * Semitones: 2 - 2 - 1 - 2 - 2 - 2 - 1
 * Formula: Whole, Whole, Half, Whole, Whole, Whole, Half
 * [0,2,4,5,7,9,11]
 * 
 * The Major Chord is the most common chord. 
 * Start with any note. This is the first note in the chord.
 * For the second note, count up four notes.
 * For the third note, count up three more notes.
 * The chord is named after the first note.
 */
export const MAJOR_CHORD_INTERVALS = [0,4,3]

/**
 * Intervals: 1, 2, b3, 4, 5, b6, b7
 * Semitones: 2 - 1 - 2 - 2 - 1 - 2 - 2
 * Formula: Whole, Half, Whole, Whole, Half, Whole, Whole
 * 
 * The Minor Chord is similar to the Major Chord except that the second note is one lower:
 * Start with any note. This is the first note in the chord.
 * For the second note, count up three notes.
 * For the third note, count up four more notes.
 * The chord is named after the first note.
 */
export const MINOR_CHORD_INTERVALS = [0,3,4]

/**
 * Diminished Chords - super sad
 */
export const DIMINISHED_CHORD_INTERVALS = [0,3,3]

/**
 * Suspended Chords - Surprising
 */
export const SUSPENDED_2_CHORD_INTERVALS = [0,2,5]
export const SUSPENDED_4_CHORD_INTERVALS = [0,5,2]

// To do sevenths
// [CHORD_INTERVALS = 4.3.4]
// const minor_sevenCHORD_INTERVALS = [3.4,3]

/**
 * https://en.wikipedia.org/wiki/Blues_scale
 */
export const MINOR_HEXATONIC_BLUES_CHORD_INTERVALS = [0,3,4]
export const MAJOR_HEXATONIC_BLUES_CHORD_INTERVALS = [0,3,4]

export const MINOR_HEPTATONIC_BLUES_CHORD_INTERVALS = [0,3,4]
export const MAJOR_HEPTATONIC_BLUES_CHORD_INTERVALS = [0,3,4]

export const MINOR_NONATONIC_BLUES_CHORD_INTERVALS = [0,3,4]
export const MAJOR_NONATONIC_BLUES_CHORD_INTERVALS = [0,3,4]



/**
 * FIXME: 
 * Intervals: 1, 2, b3, 4, 5, 6, b7
 * Semitones: 2 - 1 - 2 - 2 - 2 - 1 - 2
 * Formula: Whole, Half, Whole, Whole, Whole, Half, Whole
 * 
 */
export const DORIAN_CHORD_INTERVALS = [0,2,3,5]

export const FIFTHS_CHORD_INTERVALS = [0,5,5,5,5,5,5,5,5,5,5,5]

export const CHORD_INTERVALS = [
	MAJOR_CHORD_INTERVALS,
	MINOR_CHORD_INTERVALS,
    DIMINISHED_CHORD_INTERVALS,
	// DORIAN_CHORD_INTERVALS,
	FIFTHS_CHORD_INTERVALS
]

/**
 * Export a chord from a root note and a scale
 * 
 * @param {Array} notes 
 * @param {Array} scaleFormula 
 * @param {Number} offset 
 * @param {Number} mode 
 * @param {Boolean} cutOff 
 * @param {Boolean} accumulate 
 * @returns {Array<Number>}
 */
export const createChord = (notes, scaleFormula=MAJOR_SCALE, offset=0, mode=0, cutOff=true, accumulate=false) => {
	const quantityOfNotes = notes.length
	const quantityInScale = scaleFormula.length
	let accumulator = offset // : 0
	let output = []
    
	for (let index=0; index<quantityInScale; ++index)
	{
		const noteIndex = scaleFormula[(index+mode)%(quantityInScale)]
		if (accumulate)
		{
            // if noteIndex is 0 and index !== 0 add 12?
            if (noteIndex === 0 && index !== 0)
            {
                // this will be a note repetition so we transpose
                accumulator -= 12
                accumulator += noteIndex
            }else{
                accumulator += noteIndex
            }
		
		}else{
			accumulator = noteIndex
		}
		
		if (cutOff && accumulator > quantityOfNotes)
		{
			// ignore
		}else{
			output[index] = notes[accumulator%quantityOfNotes]
		}
	}
    
	return output
}


export const createMajorChord =( notes, offset=0, mode=0 )=> createChord( notes, MAJOR_CHORD_INTERVALS, offset, mode, true, true )
export const createMinorChord =( notes, offset=0, mode=0 )=> createChord( notes, MINOR_CHORD_INTERVALS, offset, mode, true, true )
export const createDiminishedChord =( notes, offset=0, mode=0 )=> createChord( notes, DIMINISHED_CHORD_INTERVALS, offset, mode, true, true )
// export const createJazzChord =( notes, offset=0, mode=0 )=> createChord( notes, MELODIC_MINOR_SCALE, offset, mode, true, false )
export const createFifthsChord =( notes, offset=0, mode=0 )=> createChord( notes, FIFTHS_CHORD_INTERVALS, offset, mode, false, true )

/**
 * The chord rotates the array
 * so an A D G becomes D G A
 * 
 * @param {Array} chord 
 * @param {Number} inversion 
 * @returns 
 */
export const invertChord = (chord, inversion=0) => {
	return rotateArray( chord, inversion )
}


