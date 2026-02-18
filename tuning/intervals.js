/**
 * BASIC MUSICAL INTERVALS (in semitones)
 * These define the fundamental building blocks of Western music.
 * Each interval represents the number of semitones from a root note.
 * 
 * Most scales, except the blues scale, have seven steps, 
 * while pentatonic scales have five steps.
 * there are different scales with custom tunings
 * out there but these are the classics
 * 
 */

// Unison and Simple Intervals
export const UNISON_INTERVAL = 0

// Perfect intervals (frequency ratio 1:1, 2:1, 3:2, 4:3, 5:4, etc.)
export const PERFECT_UNISON = 0         // 1:1
export const MINOR_SECOND = 1           // semitone / half-step
export const MAJOR_SECOND = 2           // whole-step
export const MINOR_THIRD = 3            // 6:5 ratio
export const MAJOR_THIRD = 4            // 5:4 ratio
export const PERFECT_FOURTH = 5         // 4:3 ratio
export const TRITONE = 6                // diminished fifth / augmented fourth (devil's interval)
export const DIMINISHED_FIFTH = 6       // same as tritone
export const AUGMENTED_FOURTH = 6       // same as tritone
export const PERFECT_FIFTH = 7          // 3:2 ratio
export const MINOR_SIXTH = 8            // 8:5 ratio
export const MAJOR_SIXTH = 9            // 5:3 ratio
export const MINOR_SEVENTH = 10         // 9:5 ratio
export const MAJOR_SEVENTH = 11         // 15:8 ratio
export const PERFECT_OCTAVE = 12        // 2:1 ratio

// Extended intervals (beyond octave)
export const DIMINISHED_SECOND = 0
export const AUGMENTED_UNISON = 1
export const DIMINISHED_THIRD = 2
export const AUGMENTED_SECOND = 3
export const DIMINISHED_FOURTH = 4
export const AUGMENTED_THIRD = 5
export const DIMINISHED_SIXTH = 7
export const AUGMENTED_FIFTH = 8
export const DIMINISHED_SEVENTH = 9
export const AUGMENTED_SIXTH = 10
export const AUGMENTED_SEVENTH = 12

// CHORD INTERVALS (root position, semitone distances)


export const MUSICAL_MODE_NAME_HARMONIC_MINOR = 'harmonicMinor'

/**
 * Diminished Chord: 1 - b3 - b5
 * Intervals in semitones: [0, 3, 6]
 * Very tense, dissonant sound.
 */
export const DIMINISHED_CHORD_INTERVALS = [0, 3, 6]

/**
 * Augmented Chord: 1 - 3 - #5
 * Intervals in semitones: [0, 4, 8]
 * Bright, shimmering sound.
 */
export const AUGMENTED_CHORD_INTERVALS = [0, 4, 8]

/**
 * Suspended 2 Chord: 1 - 2 - 5
 * Intervals in semitones: [0, 2, 7]
 * Open, unresolved sound.
 */
export const SUSPENDED_2_CHORD_INTERVALS = [0, 2, 7]

/**
 * Suspended 4 Chord: 1 - 4 - 5
 * Intervals in semitones: [0, 5, 7]
 * Open, unresolved sound (more common than sus2).
 */
export const SUSPENDED_4_CHORD_INTERVALS = [0, 5, 7]

// SEVENTH CHORDS
/**
 * Major 7th Chord: 1 - 3 - 5 - 7
 * Intervals in semitones: [0, 4, 7, 11]
 */
export const MAJOR_SEVENTH_CHORD_INTERVALS = [0, 4, 7, 11]

/**
 * Minor 7th Chord: 1 - b3 - 5 - b7
 * Intervals in semitones: [0, 3, 7, 10]
 */
export const MINOR_SEVENTH_CHORD_INTERVALS = [0, 3, 7, 10]

/**
 * Dominant 7th Chord: 1 - 3 - 5 - b7
 * Intervals in semitones: [0, 4, 7, 10]
 */
export const DOMINANT_SEVENTH_CHORD_INTERVALS = [0, 4, 7, 10]

/**
 * Half-Diminished 7th Chord: 1 - b3 - b5 - b7
 * Intervals in semitones: [0, 3, 6, 10]
 */
export const HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS = [0, 3, 6, 10]

/**
 * Diminished 7th Chord: 1 - b3 - b5 - bb7
 * Intervals in semitones: [0, 3, 6, 9]
 */
export const DIMINISHED_SEVENTH_CHORD_INTERVALS = [0, 3, 6, 9]

/**
 * Minor-Major 7th Chord: 1 - b3 - 5 - 7
 * Intervals in semitones: [0, 3, 7, 11]
 */
export const MINOR_MAJOR_SEVENTH_CHORD_INTERVALS = [0, 3, 7, 11]

// EXTENDED CHORDS (9th, 11th, 13th)
/**
 * Major 9th Chord: 1 - 3 - 5 - 7 - 9
 * Intervals in semitones: [0, 4, 7, 11, 14]
 */
export const MAJOR_NINTH_CHORD_INTERVALS = [0, 4, 7, 11, 14]

/**
 * Minor 9th Chord: 1 - b3 - 5 - b7 - 9
 * Intervals in semitones: [0, 3, 7, 10, 14]
 */
export const MINOR_NINTH_CHORD_INTERVALS = [0, 3, 7, 10, 14]

/**
 * Dominant 9th Chord: 1 - 3 - 5 - b7 - 9
 * Intervals in semitones: [0, 4, 7, 10, 14]
 */
export const DOMINANT_NINTH_CHORD_INTERVALS = [0, 4, 7, 10, 14]

// POWER CHORDS (no 3rd, just root + 5th)
/**
 * Power Chord: 1 - 5
 * Intervals in semitones: [0, 7]
 * Used heavily in rock and metal.
 */
export const POWER_CHORD_INTERVALS = [0, 7]

/**
 * Power Chord Extended: 1 - 5 - 8 (octave)
 * Intervals in semitones: [0, 7, 12]
 */
export const POWER_CHORD_EXTENDED_INTERVALS = [0, 7, 12]

// BLUES SCALES AND CHORDS
/**
 * Minor Pentatonic: 1 - b3 - 4 - 5 - b7
 * Intervals in semitones: [0, 3, 5, 7, 10]
 * Common in blues and rock.
 */
export const MINOR_PENTATONIC_INTERVALS = [0, 3, 5, 7, 10]

/**
 * Major Pentatonic: 1 - 2 - 3 - 5 - 6
 * Intervals in semitones: [0, 2, 4, 7, 9]
 * Bright pentatonic scale.
 */
export const MAJOR_PENTATONIC_INTERVALS = [0, 2, 4, 7, 9]

/**
 * Blues Scale (minor): 1 - b3 - 4 - b5 - 5 - b7
 * Intervals in semitones: [0, 3, 5, 6, 7, 10]
 */
export const BLUES_SCALE_INTERVALS = [0, 3, 5, 6, 7, 10]

// MODAL SCALES (Modes of the Major Scale)

/**
 * Major Chord: 1 - 3 - 5 (major triad)
 * Intervals in semitones: [0, 4, 7]
 * The most common chord in Western music.
 */
export const MUSICAL_MODE_NAME_MAJOR = 'Major'
export const MAJOR_CHORD_INTERVALS = [0, 4, 7]

/**
 * Minor Chord: 1 - b3 - 5 (minor triad)
 * Intervals in semitones: [0, 3, 7]
 * Softer, sadder sound than major.
 */
export const MUSICAL_MODE_NAME_NATURAL_MINOR = 'naturalMinor'
export const MUSICAL_MODE_NAME_MELODIC_MINOR = 'melodicMinor'
export const MINOR_CHORD_INTERVALS = [0, 3, 7]

/**
 * Ionian Mode (Major Scale): 1 - 2 - 3 - 4 - 5 - 6 - 7
 * Intervals in semitones: [0, 2, 4, 5, 7, 9, 11]
 * Semitone pattern: W-W-H-W-W-W-H (Whole, Whole, Half, etc.)
 * 
 * Character: Bright, happy, optimistic
 * The most common and familiar scale in Western music.
 * All natural notes with no accidentals (when starting from C).
 * 
 * Usage: Major chords, pop songs, classical compositions
 * Feeling: Resolved, stable, consonant
 */
// Scale type keys as constants
export const MUSICAL_MODE_NAME_IONIAN = 'Ionian'
export const IONIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

/**
 * Dorian Mode: 1 - 2 - b3 - 4 - 5 - 6 - b7
 * Intervals in semitones: [0, 2, 3, 5, 7, 9, 10]
 * Semitone pattern: W-H-W-W-W-H-W
 * 
 * Character: Minor sound but brighter than natural minor (Aeolian)
 * The raised 6th (major 6th) gives it an uplifting quality despite the flat 3rd.
 * Often described as "jazz minor" or having a cool, sophisticated sound.
 * 
 * Chords: Dm (or minor chords with major 6th) feel natural here
 * Usage: Jazz, funk, modal rock (Miles Davis, Herbie Hancock)
 * Feeling: Contemplative, smooth, cool
 * 
 * Key distinction from Natural Minor (Aeolian):
 * Dorian has a major 6th, while Aeolian has a minor 6th.
 * This makes Dorian sound less dark and more approachable.
 */
export const MUSICAL_MODE_NAME_DORIAN = 'Dorian'
export const DORIAN_INTERVALS = [0, 2, 3, 5, 7, 9, 10]

/**
 * Phrygian Mode: 1 - b2 - b3 - 4 - 5 - b6 - b7
 * Intervals in semitones: [0, 1, 3, 5, 7, 8, 10]
 * Semitone pattern: H-W-W-W-H-W-W
 * 
 * Character: Dark, exotic, Spanish/flamenco flavor
 * The flat 2nd (half-step from root) creates a very distinctive, tense sound.
 * Named after ancient Greek Phrygian region, reflecting its exotic origins.
 * 
 * Chords: Em (or minor chords with flat 2nd harmony)
 * Usage: Spanish music, flamenco, dark metal, world music
 * Feeling: Mysterious, intense, passionate, foreign
 * 
 * Notable: The half-step between 1 and b2 creates tension and unease,
 * making this mode perfect for dramatic or exotic compositions.
 */
export const MUSICAL_MODE_NAME_PHRYGIAN = 'Phrygian'
export const PHRYGIAN_INTERVALS = [0, 1, 3, 5, 7, 8, 10]

/**
 * Lydian Mode: 1 - 2 - 3 - #4 - 5 - 6 - 7
 * Intervals in semitones: [0, 2, 4, 6, 7, 9, 11]
 * Semitone pattern: W-W-W-H-W-W-H
 * 
 * Character: Bright, ethereal, dreamy major scale variant
 * The raised 4th (augmented 4th / sharp 4th) creates a "floating" sensation.
 * Often described as having a whimsical or magical quality.
 * 
 * Chords: Cmaj7#11 works well (major chord with raised 4th)
 * Usage: Film scores, video game music, progressive rock, avant-garde
 * Feeling: Surreal, futuristic, enchanting, otherworldly
 * 
 * Comparison to Ionian:
 * Ionian is stable major. Lydian is major with a twist—the raised 4th
 * creates just enough tension to make it sound "not quite right" in a good way.
 */
export const MUSICAL_MODE_NAME_LYDIAN = 'Lydian'
export const LYDIAN_INTERVALS = [0, 2, 4, 6, 7, 9, 11]

/**
 * Mixolydian Mode: 1 - 2 - 3 - 4 - 5 - 6 - b7
 * Intervals in semitones: [0, 2, 4, 5, 7, 9, 10]
 * Semitone pattern: W-W-H-W-W-H-W
 * 
 * Character: Dominant 7th flavor, bluesy major sound
 * The flat 7th (minor 7th) against the major triad creates a dominant color.
 * Often feels like major with a blues edge—confident but with edge.
 * 
 * Chords: G7 (or dominant 7th chords) are the primary harmony
 * Usage: Blues, rock, funk, soul, R&B
 * Feeling: Grooving, funky, soulful, slightly unresolved
 * 
 * Why it works: The flat 7th makes Mixolydian naturally "want to resolve,"
 * creating forward motion and swing. Perfect for blues and funk grooves.
 */
export const MUSICAL_MODE_NAME_MIXOLYDIAN = 'Mixolydian'
export const MIXOLYDIAN_INTERVALS = [0, 2, 4, 5, 7, 9, 10]

/**
 * Aeolian Mode (Natural Minor): 1 - 2 - b3 - 4 - 5 - b6 - b7
 * Intervals in semitones: [0, 2, 3, 5, 7, 8, 10]
 * Semitone pattern: W-H-W-W-H-W-W
 * 
 * Character: Dark, sad, introspective minor scale
 * The most common minor scale in Western music.
 * Has a balanced, melancholic sound—not too light, not too dark.
 * 
 * Chords: Am (or minor chords)
 * Usage: Rock ballads, sad songs, classical minor keys, metal
 * Feeling: Melancholic, introspective, sad, serious
 * 
 * Comparison to Dorian:
 * Aeolian has a minor 6th (b6), while Dorian has a major 6th.
 * This makes Aeolian sound darker and more traditional "sad minor."
 * 
 * Note: Not to be confused with Harmonic Minor (with raised 7th) or
 * Melodic Minor (raised 6th and 7th).
 */
export const MUSICAL_MODE_NAME_AEOLIAN = 'Aeolian'
export const AEOLIAN_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

/**
 * Locrian Mode: 1 - b2 - b3 - 4 - b5 - b6 - b7
 * Intervals in semitones: [0, 1, 3, 5, 6, 8, 10]
 * Semitone pattern: H-W-W-H-W-W-W
 * 
 * Character: Darkest, most unstable, dissonant mode
 * The half-diminished chord (Bm7b5) is built into this mode naturally.
 * Sounds diminished, anxious, unsettling—rarely used as a tonal center.
 * 
 * Chords: Bm7b5 (half-diminished chord)
 * Usage: Horror film scores, dark ambient, experimental, theoretical studies
 * Feeling: Disturbing, unstable, tense, unresolved
 * 
 * Why it's rare: The combination of flat 2, flat 5, and flat 6 creates
 * too much dissonance for most listeners. Used primarily for dramatic effect.
 * 
 * Fun fact: This mode naturally wants to resolve to another scale,
 * making it perfect for creating tension in compositions.
 */
export const MUSICAL_MODE_NAME_LOCRIAN = 'Locrian'
export const LOCRIAN_INTERVALS = [0, 1, 3, 5, 6, 8, 10]

// COLLECTION EXPORTS
export const CHORD_INTERVALS = [
    MAJOR_CHORD_INTERVALS,
    MINOR_CHORD_INTERVALS,
    DIMINISHED_CHORD_INTERVALS,
    AUGMENTED_CHORD_INTERVALS,
    SUSPENDED_2_CHORD_INTERVALS,
    SUSPENDED_4_CHORD_INTERVALS,
    MAJOR_SEVENTH_CHORD_INTERVALS,
    MINOR_SEVENTH_CHORD_INTERVALS,
    DOMINANT_SEVENTH_CHORD_INTERVALS,
    POWER_CHORD_INTERVALS
]

export const MODAL_SCALES = [
    IONIAN_INTERVALS,
    DORIAN_INTERVALS,
    PHRYGIAN_INTERVALS,
    LYDIAN_INTERVALS,
    MIXOLYDIAN_INTERVALS,
    AEOLIAN_INTERVALS,
    LOCRIAN_INTERVALS
]

export const ALL_BASIC_INTERVALS = [
    PERFECT_UNISON,
    MINOR_SECOND,
    MAJOR_SECOND,
    MINOR_THIRD,
    MAJOR_THIRD,
    PERFECT_FOURTH,
    TRITONE,
    PERFECT_FIFTH,
    MINOR_SIXTH,
    MAJOR_SIXTH,
    MINOR_SEVENTH,
    MAJOR_SEVENTH,
    PERFECT_OCTAVE
]

export const ALL_INTERVALS = [
    ...ALL_BASIC_INTERVALS,
    ...CHORD_INTERVALS,
    ...MODAL_SCALES
]

// Reverse search by interval
export const INTERVALS_MAP = new Map()
INTERVALS_MAP.set(IONIAN_INTERVALS, MUSICAL_MODE_NAME_IONIAN)
INTERVALS_MAP.set(DORIAN_INTERVALS, MUSICAL_MODE_NAME_DORIAN)
INTERVALS_MAP.set(PHRYGIAN_INTERVALS, MUSICAL_MODE_NAME_PHRYGIAN)
INTERVALS_MAP.set(LYDIAN_INTERVALS, MUSICAL_MODE_NAME_LYDIAN)
INTERVALS_MAP.set(MIXOLYDIAN_INTERVALS, MUSICAL_MODE_NAME_MIXOLYDIAN)
INTERVALS_MAP.set(AEOLIAN_INTERVALS, MUSICAL_MODE_NAME_AEOLIAN)
INTERVALS_MAP.set(LOCRIAN_INTERVALS, MUSICAL_MODE_NAME_LOCRIAN)




// Shifted intervals...
// To go from any specific note to any other specific note
export const INTERVAL_SHIFTS = {
	downOctave: -PERFECT_OCTAVE,
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
	perfectOctave: PERFECT_OCTAVE,
	upOctave: PERFECT_OCTAVE
}