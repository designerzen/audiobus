// @ts-nocheck

const rotateArray = (a, n) => {
    n = n % a.length
    return a.slice(n, a.length).concat(a.slice(0, n))
}

/**
 * 
 * @param {Array<Number>} noteNumber raw note index e.g. A0 = 21
 * @param {Number} rootNote Define the root note of the scale (e.g. A = 0)
 * @param {Array<Number>} intervalsFormula Array of intervals defining the scale
 * @returns 
 */

export const findRotationFromNote = ( noteNumber, rootNote, intervalsFormula ) => {
	const A0_MIDI_NOTE_NUMBER = 21 // Min Piano Key
	const keyNumber = noteNumber - A0_MIDI_NOTE_NUMBER
	const whichNoteInScale = (keyNumber - rootNote) % 12
	const noteIndexInFormula = intervalsFormula.indexOf( whichNoteInScale )
	// console.log('findRotationFromNote - noteNumber:', noteNumber, 'keyNumber:', keyNumber, 'whichNoteInScale:', whichNoteInScale, 'isNoteinScale:', isNoteinScale, 'noteIndexInFormula:', noteIndexInFormula)

	return noteIndexInFormula
}


/**
 * Export a chord from a root note and a scale
 * 
 * @param {Array<NoteModel|Number>} notes Note to use as the basis for the formula (usually full keyboard)
 * @param {Array<Number>} intervalsFormula Interval spacing between selected notes
 * @param {Number} offset Starting Note number
 * @param {Number} rotation If you want the formula to rotate
 * @param {Number} length If you want a specific amount of notes in your chord
 * @param {Boolean} cutOff ignore all keys after provided index
 * @param {Boolean} accumulate add to previous index
 * @returns {Array<NoteModel|Number>} Audio Note Numbers
 */
export const createChord = (notes, intervalsFormula=IONIAN_INTERVALS, offset=0, rotation=0, length=-1, cutOff=true, accumulate=false) => {

	const quantityOfNotes = notes.length
	const quantityOfIntervals = intervalsFormula.length
	const loopQuantity = length > 0 ? length : Math.min( quantityOfIntervals, quantityOfNotes )
	
	let accumulator = offset // : 0
	let output = []
    
	for (let index=0; index<loopQuantity; ++index)
	{
		const noteIndex = intervalsFormula[(index*2+rotation)%quantityOfIntervals]-intervalsFormula[rotation] // to skip every second note for chords
		if (accumulate)
		{
            // if noteIndex is 0 and index !== 0 add 12?
            if (noteIndex === 0 && index !== 0)
            {
                // this will be a note repetition so we transpose
                accumulator -= 12
                accumulator += noteIndex
            }else{
                accumulator = offset+noteIndex // add offset otherwise it increases too much the accumulator
            }
		
		}else{
			accumulator = noteIndex
		}
		
		if (cutOff && accumulator > quantityOfNotes)
		{
			// ignore
		}else{
			output.push( notes[accumulator%quantityOfNotes] )
		}
	}

	return output
}

/**
 * The chord rotates the array
 * so an A D G becomes D G A
 * 
 * @param {Array} chord 
 * @param {Number} inversion 
 * @returns 
 */
export const invertChord = (chord, inversion=0) => rotateArray( chord, inversion )

/**
 * Helpers for simplified usage
 * @param {Array<Number>} notes 
 * @param {Number} offset 
 * @param {Number} rotation 
 * @param {Number} length 
 * @returns 
 */
export const createMajorChord = ( notes, offset=0, rotation=0, length=-1 )=> createChord( notes, MAJOR_CHORD_INTERVALS, offset, rotation, length, true, true )
export const createMinorChord = ( notes, offset=0, rotation=0, length=-1 )=> createChord( notes, MINOR_CHORD_INTERVALS, offset, rotation, length, true, true )
export const createDiminishedChord = ( notes, offset=0, rotation=0, length=-1 )=> createChord( notes, DIMINISHED_CHORD_INTERVALS, offset, rotation, length, true, true )
// export const createJazzChord = ( notes, offset=0, rotation=0, length=-1 )=> createChord( notes, MELODIC_MINOR_SCALE, offset, rotation, length, true, false )
export const createFifthsChord = ( notes, offset=0, rotation=0, length=-1 )=> createChord( notes, FIFTHS_CHORD_INTERVALS, offset, rotation, length, true, true )
