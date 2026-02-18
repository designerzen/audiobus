// Scale type keys as constants
export const TUNING_MODE_MAJOR = 'major'
export const TUNING_MODE_IONIAN = 'ionian'
export const TUNING_MODE_NATURAL_MINOR = 'naturalMinor'
export const TUNING_MODE_AEOLIAN = 'aeolian'
export const TUNING_MODE_DORIAN = 'dorian'
export const TUNING_MODE_PHRYGIAN = 'phrygian'
export const TUNING_MODE_LYDIAN = 'lydian'
export const TUNING_MODE_MIXOLYDIAN = 'mixolydian'
export const TUNING_MODE_LOCRIAN = 'locrian'
export const TUNING_MODE_HARMONIC_MINOR = 'harmonicMinor'
export const TUNING_MODE_MELODIC_MINOR = 'melodicMinor'

export const TUNING_MODE_NAMES = [
    TUNING_MODE_IONIAN,			// Same as major
    TUNING_MODE_DORIAN,			// Start from second degree of major
    TUNING_MODE_PHRYGIAN,		    // Start from third degree of major
    TUNING_MODE_LYDIAN,			// Start from fourth degree of major
    TUNING_MODE_MIXOLYDIAN,		// Start from fifth degree of major
    TUNING_MODE_AEOLIAN,		    // Start from sixth degree (same as natural minor)
    TUNING_MODE_LOCRIAN			// Start from seventh degree
]

/**
 * This should take the noteNumber provided and find the
 * closest note that exists in the provided scale
 * @param noteNumber 
 * @param scaleNotes 
 * @param range 
 * @returns {Number}
 */
export const findClosestNoteInScale = (noteNumber: number, scaleNotes: Set<number>, range:number=12 ): number => {
    
    // No comparison scale
    if (!scaleNotes)
    {
        return noteNumber
    }
	
    // luckily this note is part of this scale
    if (scaleNotes.has(noteNumber)) 
    {
        return noteNumber
    }

    let closestNote = noteNumber
    let minDistance = Infinity

    // Search within a reasonable range (1 octave up and down)
    // TODO: use a smarter algo
    for (let offset = -range; offset <= range; offset++) {
        const candidateNote = noteNumber + offset

        if (scaleNotes.has(candidateNote)) {
            const distance = Math.abs(offset)

            if (distance < minDistance) {
                minDistance = distance
                closestNote = candidateNote
            }
        }
    }

    return closestNote
}

/**
 * 
 * @param root root note / tonic
 * @param intervals array of numbered intervals
 * @returns 
 */
export const generateNotesInScale = (root: number, intervals: number[]): Set<number> => {
    const scaleNotes = new Set<number>()

    // Generate notes for all octaves (MIDI range 0-127)
    for (let octave = 0; octave < 11; octave++) {
        for (const interval of intervals) {
            const note:number = root + (octave * 12) + interval
            if (note >= 0 && note <= 127) {
                scaleNotes.add(note)
            }
        }
    }
    return scaleNotes
}
