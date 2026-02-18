// Nashville Number System
import { TUNING_MODE_MAJOR, TUNING_MODE_IONIAN, TUNING_MODE_NATURAL_MINOR, TUNING_MODE_AEOLIAN, TUNING_MODE_DORIAN, TUNING_MODE_PHRYGIAN, TUNING_MODE_LYDIAN, TUNING_MODE_MIXOLYDIAN, TUNING_MODE_LOCRIAN, TUNING_MODE_HARMONIC_MINOR, TUNING_MODE_MELODIC_MINOR } from '../scales.ts'

// List of notes in order (for C major, but can be rotated for other keys)
const NOTES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
]

// Interval patterns (in semitones) for common scales and modes
const TUNING_MODE_PATTERNS: Record<string, number[]> = {
    [TUNING_MODE_MAJOR]: [0, 2, 4, 5, 7, 9, 11],
    [TUNING_MODE_IONIAN]: [0, 2, 4, 5, 7, 9, 11],
    [TUNING_MODE_NATURAL_MINOR]: [0, 2, 3, 5, 7, 8, 10],
    [TUNING_MODE_AEOLIAN]: [0, 2, 3, 5, 7, 8, 10],
    [TUNING_MODE_DORIAN]: [0, 2, 3, 5, 7, 9, 10],
    [TUNING_MODE_PHRYGIAN]: [0, 1, 3, 5, 7, 8, 10],
    [TUNING_MODE_LYDIAN]: [0, 2, 4, 6, 7, 9, 11],
    [TUNING_MODE_MIXOLYDIAN]: [0, 2, 4, 5, 7, 9, 10],
    [TUNING_MODE_LOCRIAN]: [0, 1, 3, 5, 6, 8, 10],
    [TUNING_MODE_HARMONIC_MINOR]: [0, 2, 3, 5, 7, 8, 11],
    [TUNING_MODE_MELODIC_MINOR]: [0, 2, 3, 5, 7, 9, 11]
}

// Chord qualities for each scale degree in each scale type
const CHORD_QUALITIES: Record<string, string[]> = {
    [TUNING_MODE_MAJOR]: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
    [TUNING_MODE_IONIAN]: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
    [TUNING_MODE_NATURAL_MINOR]: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
    [TUNING_MODE_AEOLIAN]: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
    [TUNING_MODE_DORIAN]: ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
    [TUNING_MODE_PHRYGIAN]: ['min', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
    [TUNING_MODE_LYDIAN]: ['maj', 'maj', 'min', 'dim', 'maj', 'min', 'min'],
    [TUNING_MODE_MIXOLYDIAN]: ['maj', 'min', 'dim', 'maj', 'min', 'maj', 'maj'],
    [TUNING_MODE_LOCRIAN]: ['dim', 'maj', 'min', 'maj', 'maj', 'min', 'maj'],
    [TUNING_MODE_HARMONIC_MINOR]: ['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'],
    [TUNING_MODE_MELODIC_MINOR]: ['min', 'min', 'aug', 'maj', 'maj', 'dim', 'dim']
}


/**
 * Generates the scale for a given key and scale type.
 * @param rootNote The root note of the key (e.g., 'C', 'G#'). Must match a value in NOTES.
 * @param scaleType The type of scale (e.g., 'major', 'minor', 'dorian', etc.). Defaults to 'major'.
 * @returns An array of note names representing the scale in the given key and type.
 * @throws Error if the key or scaleType is not valid.
 */
const scaleCache = new Map<string, string[]>()
export const getScale = (rootNote: number|string, scaleType: string = 'major'): string[] => {
    scaleType = scaleType.toUpperCase()
    const id = `${rootNote}-${scaleType}`
    if (scaleCache.has(id)) {
        return scaleCache.get(id)
    }
    const pattern = TUNING_MODE_PATTERNS[scaleType]
    if (!pattern) {
        throw new Error('Invalid scale type')
    }
    const start:number = Number.isInteger(rootNote) ? rootNote : NOTES.indexOf(rootNote)
    if (start === -1) {
        throw new Error('Invalid key')
    }
    const output = pattern.map(i => NOTES[(start + i) % 12])
    scaleCache.set(id, output)
    return output
}

// Example usage:
// getScale('C', 'major') // [ 'C', 'D', 'E', 'F', 'G', 'A', 'B' ]
// getScale('A', 'naturalMinor') // [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]
// nashvilleToChord(4, 'G', 'mixolydian') // 'C'

/**
 * Maps a Nashville Number System degree (1-7) to the corresponding chord in the given key and scale type.
 * @param n The scale degree (1-7) as used in the Nashville Number System.
 * @param key The root note of the key (e.g., 'C', 'G#').
 * @param scaleType The type of scale (e.g., 'major', 'minor', 'dorian', etc.). Defaults to 'major'.
 * @returns The chord name (e.g., 'C', 'Dm', 'Bdim') for the given degree in the key and scale type.
 * @throws Error if n is not between 1 and 7, or if the key or scaleType is invalid.
 */
const nashvilleCache = new Map<string, string>()
export const nashvilleToChord = (n: number, key: string, scaleType: string = TUNING_MODE_MAJOR ): string => {
    
    if (n < 1 || n > 7) {
        throw new Error('NNS degree must be 1-7')
    }

    const id = `${n}-${key}-${scaleType}`
    if (nashvilleCache.has(id)) {
        return nashvilleCache.get(id)
    }
      
    const qualities = CHORD_QUALITIES[scaleType]
    if (!qualities) {
        throw new Error('Invalid scale type')
    }
    const quality = qualities[n - 1]
    const scale = getScale(key, scaleType)
    const chord = scale[n - 1]
  
    // Handle augmented chords
    if (quality === 'aug'){
        return `${chord}aug`
    }
    // Handle diminished chords
    const output = `${chord}${quality === 'maj' ? '' : quality === 'min' ? 'm' : quality === 'dim' ? 'dim' : ''}`
    nashvilleCache.set(id, output)
    return output
}
// Example usage:
// getScale('C', 'major') // [ 'C', 'D', 'E', 'F', 'G', 'A', 'B' ]
// getScale('A', 'naturalMinor') // [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ]
// nashvilleToChord(4, 'G', 'mixolydian') // 'C'
