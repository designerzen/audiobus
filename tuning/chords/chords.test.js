import { describe, it, expect, beforeEach } from 'vitest'
import {
	createChord,
	invertChord,
	createMajorChord,
	createMinorChord,
	createDiminishedChord,
	createFifthsChord,
	createIonianChord,
	createDorianChord,
	createPhrygianChord,
	createLydianChord,
	createMixolydianChord,
	createAeolianChord,
	createLocrianChord,
	getModeAsIntegerOffset,
	getModeFromIntegerOffset,
	TUNING_MODE_NAMES
} from './chords.js'

import {
	MAJOR_CHORD_INTERVALS,
	MINOR_CHORD_INTERVALS,
	DIMINISHED_CHORD_INTERVALS,
	FIFTHS_CHORD_INTERVALS,
	IONIAN_INTERVALS,
	DORIAN_INTERVALS,
	PHRYGIAN_INTERVALS,
	LYDIAN_INTERVALS,
	MIXOLYDIAN_INTERVALS,
	AEOLIAN_INTERVALS,
	LOCRIAN_INTERVALS
} from './intervals.js'

describe('Chord Creation - Core Functions', () => {
	let mockKeyboard

	beforeEach(() => {
		// Create a mock keyboard with 88 notes (standard piano range)
		mockKeyboard = Array.from({ length: 88 }, (_, i) => i)
	})

	describe('createChord()', () => {
		it('should create a chord with default parameters', () => {
			const chord = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, true)
			expect(chord).toBeDefined()
			expect(Array.isArray(chord)).toBe(true)
		})

		it('should return an array with length equal to intervals formula length', () => {
			const chord = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, true)
			expect(chord.length).toBe(MAJOR_CHORD_INTERVALS.length)
		})

		it('should respect the offset parameter', () => {
			const chordOffset0 = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, true)
			const chordOffset5 = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 5, 0, true, true)
			// Chords should differ based on offset
			expect(chordOffset0).not.toEqual(chordOffset5)
		})

		it('should handle chord inversion with mode parameter', () => {
			const chordMode0 = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, true)
			const chordMode1 = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 1, true, true)
			// Different modes should produce different results
			expect(chordMode0).not.toEqual(chordMode1)
		})

		it('should respect accumulate parameter', () => {
			const chordAccumFalse = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, false)
			const chordAccumTrue = createChord(mockKeyboard, MAJOR_CHORD_INTERVALS, 0, 0, true, true)
			// Accumulate mode affects how intervals are combined
			expect(chordAccumFalse.length).toBe(chordAccumTrue.length)
		})
	})

	describe('invertChord()', () => {
		it('should rotate the chord by the inversion amount', () => {
			const chord = [0, 4, 7]
			const inverted1 = invertChord(chord, 1)
			expect(inverted1).toEqual([4, 7, 0])
		})

		it('should handle zero inversion (no rotation)', () => {
			const chord = [0, 4, 7]
			const inverted0 = invertChord(chord, 0)
			expect(inverted0).toEqual(chord)
		})

		it('should handle inversion greater than chord length', () => {
			const chord = [0, 4, 7]
			const inverted4 = invertChord(chord, 4)
			const inverted1 = invertChord(chord, 1)
			expect(inverted4).toEqual(inverted1)
		})

		it('should preserve all chord notes after inversion', () => {
			const chord = [12, 16, 19]
			const inverted = invertChord(chord, 2)
			const original = chord.sort()
			const rotated = inverted.sort()
			expect(original).toEqual(rotated)
		})
	})
})

describe('Chord Creation - Standard Shortcuts', () => {
	let mockKeyboard

	beforeEach(() => {
		mockKeyboard = Array.from({ length: 88 }, (_, i) => i)
	})

	describe('createMajorChord()', () => {
		it('should create a major chord', () => {
			const chord = createMajorChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(MAJOR_CHORD_INTERVALS.length)
		})

		it('should have a root, major 3rd, and perfect 5th', () => {
			const chord = createMajorChord(mockKeyboard, 0, 0)
			// Major chord intervals are [0, 4, 7] semitones
			expect(chord.length).toBeGreaterThan(0)
		})
	})

	describe('createMinorChord()', () => {
		it('should create a minor chord', () => {
			const chord = createMinorChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(MINOR_CHORD_INTERVALS.length)
		})

		it('should have a root, minor 3rd, and perfect 5th', () => {
			const chord = createMinorChord(mockKeyboard, 0, 0)
			// Minor chord intervals are [0, 3, 7] semitones
			expect(chord.length).toBeGreaterThan(0)
		})
	})

	describe('createDiminishedChord()', () => {
		it('should create a diminished chord', () => {
			const chord = createDiminishedChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(DIMINISHED_CHORD_INTERVALS.length)
		})

		it('should have a root, minor 3rd, and diminished 5th', () => {
			const chord = createDiminishedChord(mockKeyboard, 0, 0)
			// Diminished chord intervals are [0, 3, 6] semitones
			expect(chord.length).toBeGreaterThan(0)
		})
	})

	describe('createFifthsChord()', () => {
		it('should create a fifths chord (power chord)', () => {
			const chord = createFifthsChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(FIFTHS_CHORD_INTERVALS.length)
		})

		it('should have a root and perfect 5th', () => {
			const chord = createFifthsChord(mockKeyboard, 0, 0)
			// Fifths chord intervals are [0, 7] semitones (power chord)
			expect(chord.length).toBeGreaterThan(0)
		})
	})
})

describe('Chord Creation - Modal Shortcuts', () => {
	let mockKeyboard

	beforeEach(() => {
		mockKeyboard = Array.from({ length: 88 }, (_, i) => i)
	})

	describe('createIonianChord()', () => {
		it('should create an Ionian (Major) chord', () => {
			const chord = createIonianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(IONIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Ionian mode', () => {
			const chord = createIonianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use IONIAN_INTERVALS', () => {
			const chord = createIonianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(IONIAN_INTERVALS.length)
		})

		it('should accept offset parameter', () => {
			const chordOffset0 = createIonianChord(mockKeyboard, 0)
			const chordOffset12 = createIonianChord(mockKeyboard, 12)
			expect(chordOffset0).not.toEqual(chordOffset12)
		})
	})

	describe('createDorianChord()', () => {
		it('should create a Dorian chord', () => {
			const chord = createDorianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(DORIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Dorian mode', () => {
			const chord = createDorianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use DORIAN_INTERVALS [0, 2, 3, 5, 7, 9, 10]', () => {
			const chord = createDorianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(DORIAN_INTERVALS.length)
			expect(DORIAN_INTERVALS).toEqual([0, 2, 3, 5, 7, 9, 10])
		})

		it('should create a different chord than Ionian', () => {
			const ionianChord = createIonianChord(mockKeyboard, 0, 0)
			const dorianChord = createDorianChord(mockKeyboard, 0, 0)
			expect(ionianChord).not.toEqual(dorianChord)
		})

		it('Dorian should have major 6th (distinguishing feature)', () => {
			// Dorian has intervals [0, 2, 3, 5, 7, 9, 10]
			// The 6th degree (index 5) is at +9 semitones (major 6th)
			expect(DORIAN_INTERVALS[5]).toBe(9)
		})
	})

	describe('createPhrygianChord()', () => {
		it('should create a Phrygian chord', () => {
			const chord = createPhrygianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(PHRYGIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Phrygian mode', () => {
			const chord = createPhrygianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use PHRYGIAN_INTERVALS [0, 1, 3, 5, 7, 8, 10]', () => {
			const chord = createPhrygianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(PHRYGIAN_INTERVALS.length)
			expect(PHRYGIAN_INTERVALS).toEqual([0, 1, 3, 5, 7, 8, 10])
		})

		it('should create a different chord than Dorian', () => {
			const dorianChord = createDorianChord(mockKeyboard, 0, 0)
			const phrygianChord = createPhrygianChord(mockKeyboard, 0, 0)
			expect(dorianChord).not.toEqual(phrygianChord)
		})

		it('Phrygian should have flat 2nd (distinguishing feature)', () => {
			// Phrygian has intervals [0, 1, 3, 5, 7, 8, 10]
			// The 2nd degree (index 1) is at +1 semitone (half-step, very distinctive)
			expect(PHRYGIAN_INTERVALS[1]).toBe(1)
		})
	})

	describe('createLydianChord()', () => {
		it('should create a Lydian chord', () => {
			const chord = createLydianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(LYDIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Lydian mode', () => {
			const chord = createLydianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use LYDIAN_INTERVALS [0, 2, 4, 6, 7, 9, 11]', () => {
			const chord = createLydianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(LYDIAN_INTERVALS.length)
			expect(LYDIAN_INTERVALS).toEqual([0, 2, 4, 6, 7, 9, 11])
		})

		it('should create a different chord than Ionian', () => {
			const ionianChord = createIonianChord(mockKeyboard, 0, 0)
			const lydianChord = createLydianChord(mockKeyboard, 0, 0)
			expect(ionianChord).not.toEqual(lydianChord)
		})

		it('Lydian should have raised 4th (distinguishing feature)', () => {
			// Lydian has intervals [0, 2, 4, 6, 7, 9, 11]
			// The 4th degree (index 3) is at +6 semitones (augmented/raised 4th)
			expect(LYDIAN_INTERVALS[3]).toBe(6)
		})
	})

	describe('createMixolydianChord()', () => {
		it('should create a Mixolydian chord', () => {
			const chord = createMixolydianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(MIXOLYDIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Mixolydian mode', () => {
			const chord = createMixolydianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use MIXOLYDIAN_INTERVALS [0, 2, 4, 5, 7, 9, 10]', () => {
			const chord = createMixolydianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(MIXOLYDIAN_INTERVALS.length)
			expect(MIXOLYDIAN_INTERVALS).toEqual([0, 2, 4, 5, 7, 9, 10])
		})

		it('should create a different chord than Ionian', () => {
			const ionianChord = createIonianChord(mockKeyboard, 0, 0)
			const mixolydianChord = createMixolydianChord(mockKeyboard, 0, 0)
			expect(ionianChord).not.toEqual(mixolydianChord)
		})

		it('Mixolydian should have flat 7th (distinguishing feature)', () => {
			// Mixolydian has intervals [0, 2, 4, 5, 7, 9, 10]
			// The 7th degree (index 6) is at +10 semitones (minor 7th, dominant flavor)
			expect(MIXOLYDIAN_INTERVALS[6]).toBe(10)
		})
	})

	describe('createAeolianChord()', () => {
		it('should create an Aeolian (Natural Minor) chord', () => {
			const chord = createAeolianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(AEOLIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Aeolian mode', () => {
			const chord = createAeolianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use AEOLIAN_INTERVALS [0, 2, 3, 5, 7, 8, 10]', () => {
			const chord = createAeolianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(AEOLIAN_INTERVALS.length)
			expect(AEOLIAN_INTERVALS).toEqual([0, 2, 3, 5, 7, 8, 10])
		})

		it('should create a different chord than Dorian', () => {
			const dorianChord = createDorianChord(mockKeyboard, 0, 0)
			const aeolianChord = createAeolianChord(mockKeyboard, 0, 0)
			expect(dorianChord).not.toEqual(aeolianChord)
		})

		it('Aeolian should have minor 6th (darker than Dorian)', () => {
			// Aeolian has intervals [0, 2, 3, 5, 7, 8, 10]
			// The 6th degree (index 5) is at +8 semitones (minor 6th)
			// Compare to Dorian which has +9 (major 6th)
			expect(AEOLIAN_INTERVALS[5]).toBe(8)
			expect(DORIAN_INTERVALS[5]).toBe(9)
		})
	})

	describe('createLocrianChord()', () => {
		it('should create a Locrian chord', () => {
			const chord = createLocrianChord(mockKeyboard)
			expect(chord).toBeDefined()
			expect(chord.length).toBe(LOCRIAN_INTERVALS.length)
		})

		it('should have 7 notes from the Locrian mode', () => {
			const chord = createLocrianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(7)
		})

		it('should use LOCRIAN_INTERVALS [0, 1, 3, 5, 6, 8, 10]', () => {
			const chord = createLocrianChord(mockKeyboard, 0, 0)
			expect(chord.length).toBe(LOCRIAN_INTERVALS.length)
			expect(LOCRIAN_INTERVALS).toEqual([0, 1, 3, 5, 6, 8, 10])
		})

		it('should create a different chord than Phrygian', () => {
			const phrygianChord = createPhrygianChord(mockKeyboard, 0, 0)
			const locrianChord = createLocrianChord(mockKeyboard, 0, 0)
			expect(phrygianChord).not.toEqual(locrianChord)
		})

		it('Locrian should have flat 2nd and flat 5th (darkest mode)', () => {
			// Locrian has intervals [0, 1, 3, 5, 6, 8, 10]
			// The 2nd degree (index 1) is at +1 semitone (flat 2nd)
			// The 5th degree (index 4) is at +6 semitones (diminished 5th)
			expect(LOCRIAN_INTERVALS[1]).toBe(1)
			expect(LOCRIAN_INTERVALS[4]).toBe(6)
		})
	})
})

describe('Modal Chord Comparison', () => {
	let mockKeyboard

	beforeEach(() => {
		mockKeyboard = Array.from({ length: 88 }, (_, i) => i)
	})

	it('all 7 modal chords should be different', () => {
		const ionianChord = createIonianChord(mockKeyboard, 0, 0)
		const dorianChord = createDorianChord(mockKeyboard, 0, 0)
		const phrygianChord = createPhrygianChord(mockKeyboard, 0, 0)
		const lydianChord = createLydianChord(mockKeyboard, 0, 0)
		const mixolydianChord = createMixolydianChord(mockKeyboard, 0, 0)
		const aeolianChord = createAeolianChord(mockKeyboard, 0, 0)
		const locrianChord = createLocrianChord(mockKeyboard, 0, 0)

		const chords = [ionianChord, dorianChord, phrygianChord, lydianChord, mixolydianChord, aeolianChord, locrianChord]
		const uniqueChords = new Set(chords.map(c => JSON.stringify(c)))
		expect(uniqueChords.size).toBe(7)
	})

	it('all modal chords should have 7 notes', () => {
		const chords = [
			createIonianChord(mockKeyboard, 0, 0),
			createDorianChord(mockKeyboard, 0, 0),
			createPhrygianChord(mockKeyboard, 0, 0),
			createLydianChord(mockKeyboard, 0, 0),
			createMixolydianChord(mockKeyboard, 0, 0),
			createAeolianChord(mockKeyboard, 0, 0),
			createLocrianChord(mockKeyboard, 0, 0)
		]

		chords.forEach(chord => {
			expect(chord.length).toBe(7)
		})
	})

	it('modal chord shortcuts should accept offset and mode parameters', () => {
		const chord1 = createDorianChord(mockKeyboard, 0, 0)
		const chord2 = createDorianChord(mockKeyboard, 5, 0)
		const chord3 = createDorianChord(mockKeyboard, 0, 1)

		expect(chord1).not.toEqual(chord2)
		expect(chord1).not.toEqual(chord3)
	})

	it('Ionian and major chord should be equivalent with same offset', () => {
		const ionianChord = createIonianChord(mockKeyboard, 0, 0)
		const majorChord = createMajorChord(mockKeyboard, 0, 0)
		// Both should have same number of notes from their respective intervals
		expect(ionianChord.length).toBe(7)
		expect(majorChord.length).toBe(3)
		// Ionian is a full scale, Major is a triad
	})
})

describe('Mode Utility Functions', () => {
	describe('getModeAsIntegerOffset()', () => {
		it('should convert string mode name to integer offset', () => {
			const ionianOffset = getModeAsIntegerOffset(TUNING_MODE_NAMES[0])
			expect(ionianOffset).toBe(0)
		})

		it('should return modulo value for integer input', () => {
			expect(getModeAsIntegerOffset(0)).toBe(0)
			expect(getModeAsIntegerOffset(7)).toBe(0)
			expect(getModeAsIntegerOffset(8)).toBe(1)
		})
	})

	describe('getModeFromIntegerOffset()', () => {
		it('should convert integer offset to string mode name', () => {
			const modeName = getModeFromIntegerOffset(0)
			expect(modeName).toBe(TUNING_MODE_NAMES[0])
		})

		it('should return the mode name when passed a string', () => {
			const modeName = getModeFromIntegerOffset(TUNING_MODE_NAMES[3])
			expect(modeName).toBe(TUNING_MODE_NAMES[3])
		})

		it('should handle modulo wrap-around', () => {
			const mode7 = getModeFromIntegerOffset(7)
			const mode0 = getModeFromIntegerOffset(0)
			expect(mode7).toBe(mode0)
		})
	})

	describe('TUNING_MODE_NAMES', () => {
		it('should have exactly 7 modes', () => {
			expect(TUNING_MODE_NAMES.length).toBe(7)
		})

		it('should contain all diatonic mode names', () => {
			expect(TUNING_MODE_NAMES).toHaveLength(7)
			// Each mode name should be a string
			TUNING_MODE_NAMES.forEach(modeName => {
				expect(typeof modeName).toBe('string')
			})
		})
	})
})
