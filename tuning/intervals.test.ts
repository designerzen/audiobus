// @ts-nocheck
/**
 * Vitest tests for intervals.js
 * Validates all interval definitions and their correctness
 */

import { describe, test, expect } from 'vitest'
import {
    // Basic Intervals
    UNISON_INTERVAL,
    PERFECT_UNISON,
    MINOR_SECOND,
    MAJOR_SECOND,
    MINOR_THIRD,
    MAJOR_THIRD,
    PERFECT_FOURTH,
    TRITONE,
    DIMINISHED_FIFTH,
    AUGMENTED_FOURTH,
    PERFECT_FIFTH,
    MINOR_SIXTH,
    MAJOR_SIXTH,
    MINOR_SEVENTH,
    MAJOR_SEVENTH,
    PERFECT_OCTAVE,
    
    // Extended Intervals
    AUGMENTED_UNISON,
    DIMINISHED_SECOND,
    AUGMENTED_SECOND,
    DIMINISHED_THIRD,
    AUGMENTED_THIRD,
    DIMINISHED_FOURTH,
    AUGMENTED_FIFTH,
    DIMINISHED_SIXTH,
    AUGMENTED_SIXTH,
    DIMINISHED_SEVENTH,
    AUGMENTED_SEVENTH,
    
    // Chord Intervals
    MAJOR_CHORD_INTERVALS,
    MINOR_CHORD_INTERVALS,
    DIMINISHED_CHORD_INTERVALS,
    AUGMENTED_CHORD_INTERVALS,
    SUSPENDED_2_CHORD_INTERVALS,
    SUSPENDED_4_CHORD_INTERVALS,
    MAJOR_SEVENTH_CHORD_INTERVALS,
    MINOR_SEVENTH_CHORD_INTERVALS,
    DOMINANT_SEVENTH_CHORD_INTERVALS,
    HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS,
    DIMINISHED_SEVENTH_CHORD_INTERVALS,
    MINOR_MAJOR_SEVENTH_CHORD_INTERVALS,
    MAJOR_NINTH_CHORD_INTERVALS,
    MINOR_NINTH_CHORD_INTERVALS,
    DOMINANT_NINTH_CHORD_INTERVALS,
    POWER_CHORD_INTERVALS,
    POWER_CHORD_EXTENDED_INTERVALS,
    
    // Scale Intervals
    MINOR_PENTATONIC_INTERVALS,
    MAJOR_PENTATONIC_INTERVALS,
    BLUES_SCALE_INTERVALS,
    IONIAN_INTERVALS,
    DORIAN_INTERVALS,
    PHRYGIAN_INTERVALS,
    LYDIAN_INTERVALS,
    MIXOLYDIAN_INTERVALS,
    AEOLIAN_INTERVALS,
    LOCRIAN_INTERVALS,
    
    // Collections
    CHORD_INTERVALS,
    MODAL_SCALES,
    ALL_BASIC_INTERVALS
} from './intervals.js'

describe('Basic Intervals', () => {
    describe('Unison and Unison-like', () => {
        test('UNISON_INTERVAL should be 0', () => {
            expect(UNISON_INTERVAL).toBe(0)
        })

        test('PERFECT_UNISON should be 0', () => {
            expect(PERFECT_UNISON).toBe(0)
        })

        test('AUGMENTED_UNISON should be 1 semitone', () => {
            expect(AUGMENTED_UNISON).toBe(1)
        })
    })

    describe('Seconds', () => {
        test('MINOR_SECOND should be 1 semitone', () => {
            expect(MINOR_SECOND).toBe(1)
        })

        test('MAJOR_SECOND should be 2 semitones', () => {
            expect(MAJOR_SECOND).toBe(2)
        })

        test('DIMINISHED_SECOND should be 0 semitones', () => {
            expect(DIMINISHED_SECOND).toBe(0)
        })

        test('AUGMENTED_SECOND should be 3 semitones', () => {
            expect(AUGMENTED_SECOND).toBe(3)
        })
    })

    describe('Thirds', () => {
        test('MINOR_THIRD should be 3 semitones', () => {
            expect(MINOR_THIRD).toBe(3)
        })

        test('MAJOR_THIRD should be 4 semitones', () => {
            expect(MAJOR_THIRD).toBe(4)
        })

        test('DIMINISHED_THIRD should be 2 semitones', () => {
            expect(DIMINISHED_THIRD).toBe(2)
        })

        test('AUGMENTED_THIRD should be 5 semitones', () => {
            expect(AUGMENTED_THIRD).toBe(5)
        })
    })

    describe('Fourths and Tritone', () => {
        test('PERFECT_FOURTH should be 5 semitones', () => {
            expect(PERFECT_FOURTH).toBe(5)
        })

        test('TRITONE should be 6 semitones', () => {
            expect(TRITONE).toBe(6)
        })

        test('DIMINISHED_FIFTH should equal TRITONE', () => {
            expect(DIMINISHED_FIFTH).toBe(TRITONE)
        })

        test('AUGMENTED_FOURTH should equal TRITONE', () => {
            expect(AUGMENTED_FOURTH).toBe(TRITONE)
        })

        test('DIMINISHED_FOURTH should be 4 semitones', () => {
            expect(DIMINISHED_FOURTH).toBe(4)
        })
    })

    describe('Fifths', () => {
        test('PERFECT_FIFTH should be 7 semitones', () => {
            expect(PERFECT_FIFTH).toBe(7)
        })

        test('AUGMENTED_FIFTH should be 8 semitones', () => {
            expect(AUGMENTED_FIFTH).toBe(8)
        })
    })

    describe('Sixths', () => {
        test('MINOR_SIXTH should be 8 semitones', () => {
            expect(MINOR_SIXTH).toBe(8)
        })

        test('MAJOR_SIXTH should be 9 semitones', () => {
            expect(MAJOR_SIXTH).toBe(9)
        })

        test('DIMINISHED_SIXTH should be 7 semitones', () => {
            expect(DIMINISHED_SIXTH).toBe(7)
        })

        test('AUGMENTED_SIXTH should be 10 semitones', () => {
            expect(AUGMENTED_SIXTH).toBe(10)
        })
    })

    describe('Sevenths', () => {
        test('MINOR_SEVENTH should be 10 semitones', () => {
            expect(MINOR_SEVENTH).toBe(10)
        })

        test('MAJOR_SEVENTH should be 11 semitones', () => {
            expect(MAJOR_SEVENTH).toBe(11)
        })

        test('DIMINISHED_SEVENTH should be 9 semitones', () => {
            expect(DIMINISHED_SEVENTH).toBe(9)
        })

        test('AUGMENTED_SEVENTH should be 12 semitones', () => {
            expect(AUGMENTED_SEVENTH).toBe(12)
        })
    })

    describe('Octave', () => {
        test('PERFECT_OCTAVE should be 12 semitones', () => {
            expect(PERFECT_OCTAVE).toBe(12)
        })
    })
})

describe('Chord Intervals', () => {
    describe('Triads', () => {
        test('MAJOR_CHORD_INTERVALS should be [0, 4, 7]', () => {
            expect(MAJOR_CHORD_INTERVALS).toEqual([0, 4, 7])
        })

        test('MINOR_CHORD_INTERVALS should be [0, 3, 7]', () => {
            expect(MINOR_CHORD_INTERVALS).toEqual([0, 3, 7])
        })

        test('DIMINISHED_CHORD_INTERVALS should be [0, 3, 6]', () => {
            expect(DIMINISHED_CHORD_INTERVALS).toEqual([0, 3, 6])
        })

        test('AUGMENTED_CHORD_INTERVALS should be [0, 4, 8]', () => {
            expect(AUGMENTED_CHORD_INTERVALS).toEqual([0, 4, 8])
        })
    })

    describe('Suspended Chords', () => {
        test('SUSPENDED_2_CHORD_INTERVALS should be [0, 2, 7]', () => {
            expect(SUSPENDED_2_CHORD_INTERVALS).toEqual([0, 2, 7])
        })

        test('SUSPENDED_4_CHORD_INTERVALS should be [0, 5, 7]', () => {
            expect(SUSPENDED_4_CHORD_INTERVALS).toEqual([0, 5, 7])
        })
    })

    describe('Seventh Chords', () => {
        test('MAJOR_SEVENTH_CHORD_INTERVALS should be [0, 4, 7, 11]', () => {
            expect(MAJOR_SEVENTH_CHORD_INTERVALS).toEqual([0, 4, 7, 11])
        })

        test('MINOR_SEVENTH_CHORD_INTERVALS should be [0, 3, 7, 10]', () => {
            expect(MINOR_SEVENTH_CHORD_INTERVALS).toEqual([0, 3, 7, 10])
        })

        test('DOMINANT_SEVENTH_CHORD_INTERVALS should be [0, 4, 7, 10]', () => {
            expect(DOMINANT_SEVENTH_CHORD_INTERVALS).toEqual([0, 4, 7, 10])
        })

        test('HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS should be [0, 3, 6, 10]', () => {
            expect(HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS).toEqual([0, 3, 6, 10])
        })

        test('DIMINISHED_SEVENTH_CHORD_INTERVALS should be [0, 3, 6, 9]', () => {
            expect(DIMINISHED_SEVENTH_CHORD_INTERVALS).toEqual([0, 3, 6, 9])
        })

        test('MINOR_MAJOR_SEVENTH_CHORD_INTERVALS should be [0, 3, 7, 11]', () => {
            expect(MINOR_MAJOR_SEVENTH_CHORD_INTERVALS).toEqual([0, 3, 7, 11])
        })
    })

    describe('Extended Chords', () => {
        test('MAJOR_NINTH_CHORD_INTERVALS should be [0, 4, 7, 11, 14]', () => {
            expect(MAJOR_NINTH_CHORD_INTERVALS).toEqual([0, 4, 7, 11, 14])
        })

        test('MINOR_NINTH_CHORD_INTERVALS should be [0, 3, 7, 10, 14]', () => {
            expect(MINOR_NINTH_CHORD_INTERVALS).toEqual([0, 3, 7, 10, 14])
        })

        test('DOMINANT_NINTH_CHORD_INTERVALS should be [0, 4, 7, 10, 14]', () => {
            expect(DOMINANT_NINTH_CHORD_INTERVALS).toEqual([0, 4, 7, 10, 14])
        })
    })

    describe('Power Chords', () => {
        test('POWER_CHORD_INTERVALS should be [0, 7]', () => {
            expect(POWER_CHORD_INTERVALS).toEqual([0, 7])
        })

        test('POWER_CHORD_EXTENDED_INTERVALS should be [0, 7, 12]', () => {
            expect(POWER_CHORD_EXTENDED_INTERVALS).toEqual([0, 7, 12])
        })
    })
})

describe('Scale Intervals', () => {
    describe('Pentatonic Scales', () => {
        test('MINOR_PENTATONIC_INTERVALS should be [0, 3, 5, 7, 10]', () => {
            expect(MINOR_PENTATONIC_INTERVALS).toEqual([0, 3, 5, 7, 10])
        })

        test('MAJOR_PENTATONIC_INTERVALS should be [0, 2, 4, 7, 9]', () => {
            expect(MAJOR_PENTATONIC_INTERVALS).toEqual([0, 2, 4, 7, 9])
        })
    })

    describe('Blues Scale', () => {
        test('BLUES_SCALE_INTERVALS should be [0, 3, 5, 6, 7, 10]', () => {
            expect(BLUES_SCALE_INTERVALS).toEqual([0, 3, 5, 6, 7, 10])
        })
    })

    describe('Modes of the Major Scale (Diatonic Modes)', () => {
        test('IONIAN_INTERVALS (Major) should be [0, 2, 4, 5, 7, 9, 11]', () => {
            expect(IONIAN_INTERVALS).toEqual([0, 2, 4, 5, 7, 9, 11])
        })

        test('DORIAN_INTERVALS should be [0, 2, 3, 5, 7, 9, 10]', () => {
            expect(DORIAN_INTERVALS).toEqual([0, 2, 3, 5, 7, 9, 10])
        })

        test('PHRYGIAN_INTERVALS should be [0, 1, 3, 5, 7, 8, 10]', () => {
            expect(PHRYGIAN_INTERVALS).toEqual([0, 1, 3, 5, 7, 8, 10])
        })

        test('LYDIAN_INTERVALS should be [0, 2, 4, 6, 7, 9, 11]', () => {
            expect(LYDIAN_INTERVALS).toEqual([0, 2, 4, 6, 7, 9, 11])
        })

        test('MIXOLYDIAN_INTERVALS should be [0, 2, 4, 5, 7, 9, 10]', () => {
            expect(MIXOLYDIAN_INTERVALS).toEqual([0, 2, 4, 5, 7, 9, 10])
        })

        test('AEOLIAN_INTERVALS (Natural Minor) should be [0, 2, 3, 5, 7, 8, 10]', () => {
            expect(AEOLIAN_INTERVALS).toEqual([0, 2, 3, 5, 7, 8, 10])
        })

        test('LOCRIAN_INTERVALS should be [0, 1, 3, 5, 6, 8, 10]', () => {
            expect(LOCRIAN_INTERVALS).toEqual([0, 1, 3, 5, 6, 8, 10])
        })
    })

    describe('Modal Characteristics', () => {
        test('Dorian should have major 6th while Aeolian has minor 6th', () => {
            // Dorian: 6th is at 9 semitones
            expect(DORIAN_INTERVALS).toContain(9)
            // Aeolian: 6th is at 8 semitones
            expect(AEOLIAN_INTERVALS).toContain(8)
            // Dorian 6th is 1 semitone higher than Aeolian
            expect(DORIAN_INTERVALS[5] - AEOLIAN_INTERVALS[5]).toBe(1)
        })

        test('Lydian should have raised 4th (augmented 4th)', () => {
            // Lydian has 4th at 6 semitones (raised)
            expect(LYDIAN_INTERVALS[3]).toBe(6)
            // Ionian (major) has perfect 4th at 5 semitones
            expect(IONIAN_INTERVALS[3]).toBe(5)
            // Difference of 1 semitone
            expect(LYDIAN_INTERVALS[3] - IONIAN_INTERVALS[3]).toBe(1)
        })

        test('Phrygian should have flat 2nd (very close to root)', () => {
            // Phrygian: 2nd is only 1 semitone from root
            expect(PHRYGIAN_INTERVALS[1]).toBe(1)
            // Major/Ionian: 2nd is 2 semitones from root
            expect(IONIAN_INTERVALS[1]).toBe(2)
        })

        test('Locrian should have both flat 2nd and flat 5th', () => {
            // Locrian has flat 2nd at 1 semitone
            expect(LOCRIAN_INTERVALS[1]).toBe(1)
            // Locrian has flat 5th at 6 semitones
            expect(LOCRIAN_INTERVALS[4]).toBe(6)
        })

        test('Mixolydian should have flat 7th (dominant flavor)', () => {
            // Mixolydian: 7th is 10 semitones (minor 7th)
            expect(MIXOLYDIAN_INTERVALS[6]).toBe(10)
            // Ionian (Major): 7th is 11 semitones (major 7th)
            expect(IONIAN_INTERVALS[6]).toBe(11)
            // Difference of 1 semitone
            expect(MIXOLYDIAN_INTERVALS[6] - IONIAN_INTERVALS[6]).toBe(-1)
        })
    })
})

describe('Modal Scales Collection', () => {
    test('MODAL_SCALES should contain exactly 7 modes', () => {
        expect(MODAL_SCALES.length).toBe(7)
    })

    test('All modal scales should have 7 notes', () => {
        MODAL_SCALES.forEach(mode => {
            expect(mode.length).toBe(7)
        })
    })

    test('All modal scales should start at 0 (root)', () => {
        MODAL_SCALES.forEach(mode => {
            expect(mode[0]).toBe(0)
        })
    })

    test('All modal scales should end at 11 or 10 semitones (before octave)', () => {
        MODAL_SCALES.forEach(mode => {
            const lastInterval = mode[mode.length - 1]
            expect(lastInterval === 10 || lastInterval === 11).toBe(true)
        })
    })

    test('All modal scales should be in ascending order', () => {
        MODAL_SCALES.forEach(mode => {
            for (let i = 1; i < mode.length; i++) {
                expect(mode[i]).toBeGreaterThan(mode[i - 1])
            }
        })
    })

    test('All modal scales should be contained within one octave', () => {
        MODAL_SCALES.forEach(mode => {
            mode.forEach(interval => {
                expect(interval).toBeLessThanOrEqual(11)
            })
        })
    })

    test('Modal scales should contain correct order: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian', () => {
        expect(MODAL_SCALES[0]).toEqual(IONIAN_INTERVALS)
        expect(MODAL_SCALES[1]).toEqual(DORIAN_INTERVALS)
        expect(MODAL_SCALES[2]).toEqual(PHRYGIAN_INTERVALS)
        expect(MODAL_SCALES[3]).toEqual(LYDIAN_INTERVALS)
        expect(MODAL_SCALES[4]).toEqual(MIXOLYDIAN_INTERVALS)
        expect(MODAL_SCALES[5]).toEqual(AEOLIAN_INTERVALS)
        expect(MODAL_SCALES[6]).toEqual(LOCRIAN_INTERVALS)
    })
})

describe('Chord Collections', () => {
    test('CHORD_INTERVALS should contain at least 10 chord types', () => {
        expect(CHORD_INTERVALS.length).toBeGreaterThanOrEqual(10)
    })

    test('CHORD_INTERVALS should start with MAJOR_CHORD_INTERVALS', () => {
        expect(CHORD_INTERVALS[0]).toEqual(MAJOR_CHORD_INTERVALS)
    })

    test('ALL_BASIC_INTERVALS should have 13 intervals (unison to octave)', () => {
        expect(ALL_BASIC_INTERVALS.length).toBe(13)
    })

    test('ALL_BASIC_INTERVALS should start at 0 and end at 12', () => {
        expect(ALL_BASIC_INTERVALS[0]).toBe(0)
        expect(ALL_BASIC_INTERVALS[ALL_BASIC_INTERVALS.length - 1]).toBe(12)
    })

    test('ALL_BASIC_INTERVALS should be in ascending order', () => {
        for (let i = 1; i < ALL_BASIC_INTERVALS.length; i++) {
            expect(ALL_BASIC_INTERVALS[i]).toBeGreaterThanOrEqual(ALL_BASIC_INTERVALS[i - 1])
        }
    })
})

describe('Interval Relationships', () => {
    test('All chord intervals should start with 0 (root)', () => {
        CHORD_INTERVALS.forEach(chord => {
            expect(chord[0]).toBe(0)
        })
    })

    test('All chord intervals should be in ascending order', () => {
        CHORD_INTERVALS.forEach(chord => {
            for (let i = 1; i < chord.length; i++) {
                expect(chord[i]).toBeGreaterThan(chord[i - 1])
            }
        })
    })

    test('Ninth chords should have notes that extend beyond octave', () => {
        const ninthChords = [
            MAJOR_NINTH_CHORD_INTERVALS,
            MINOR_NINTH_CHORD_INTERVALS,
            DOMINANT_NINTH_CHORD_INTERVALS
        ]
        ninthChords.forEach(chord => {
            const maxInterval = Math.max(...chord)
            expect(maxInterval).toBeGreaterThan(12)
        })
    })

    test('Major and minor chords should differ by one semitone in 3rd', () => {
        expect(MAJOR_CHORD_INTERVALS[1] - MINOR_CHORD_INTERVALS[1]).toBe(1)
    })

    test('Augmented and diminished chords should differ from major/minor', () => {
        // Augmented vs Major: 3rd is one semitone higher
        expect(AUGMENTED_CHORD_INTERVALS[2] - MAJOR_CHORD_INTERVALS[2]).toBe(1)
        // Diminished vs Minor: 5th is one semitone lower
        expect(MINOR_CHORD_INTERVALS[2] - DIMINISHED_CHORD_INTERVALS[2]).toBe(1)
    })

    test('Suspended chords should not contain a 3rd (no 3 or 4 semitone)', () => {
        // Sus2 and Sus4 replace the 3rd with 2nd or 4th
        expect(SUSPENDED_2_CHORD_INTERVALS).not.toContain(3)
        expect(SUSPENDED_2_CHORD_INTERVALS).not.toContain(4)
        
        expect(SUSPENDED_4_CHORD_INTERVALS).not.toContain(3)
        expect(SUSPENDED_4_CHORD_INTERVALS).not.toContain(4)
    })

    test('7th chords should have major 7th (11 semitones) or minor 7th (10 semitones)', () => {
        expect(MAJOR_SEVENTH_CHORD_INTERVALS[3]).toBe(11)
        expect(MINOR_SEVENTH_CHORD_INTERVALS[3]).toBe(10)
        expect(DOMINANT_SEVENTH_CHORD_INTERVALS[3]).toBe(10)
    })
})

describe('Interval Validation', () => {
    test('All intervals should be non-negative integers', () => {
        const allIntervals = [
            UNISON_INTERVAL, PERFECT_UNISON, MINOR_SECOND, MAJOR_SECOND,
            MINOR_THIRD, MAJOR_THIRD, PERFECT_FOURTH, TRITONE,
            PERFECT_FIFTH, MINOR_SIXTH, MAJOR_SIXTH, MINOR_SEVENTH,
            MAJOR_SEVENTH, PERFECT_OCTAVE
        ]
        allIntervals.forEach(interval => {
            expect(Number.isInteger(interval)).toBe(true)
            expect(interval).toBeGreaterThanOrEqual(0)
        })
    })

    test('Basic intervals should be within one octave', () => {
        ALL_BASIC_INTERVALS.forEach(interval => {
            expect(interval).toBeLessThanOrEqual(12)
        })
    })

    test('Power chords should only contain root and fifth', () => {
        expect(POWER_CHORD_INTERVALS).toEqual([0, 7])
        expect(POWER_CHORD_INTERVALS).toHaveLength(2)
    })
})

