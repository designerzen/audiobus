/**
 * Pass in an array of NoteNumbers and this will
 * try and show which scales, keys and musical modes
 * are being used in as much detail as possible
 */

/**
 * Convert an array of numbers into a array of
 * intervals, where each entry represents the 
 * difference between subsequent entries
 */
export const convertToIntervalArray = (notes: Array<number>) => {
    return notes.map((currentNote, index) => {
        const previousNote = index > 0 ? notes[index - 1] : currentNote
        return currentNote - previousNote
    })
}

/**
 * Determine Musical Mode (Ionian, Dorian...)
 */
export const describeMusicalMode = (intervals: Array<Number>) => {
    // which we then use to determine how many numbers are
    // between each entry
    const output = ALL_INTERVALS.filter( interval => interval.contains(intervals))
    return output
}
