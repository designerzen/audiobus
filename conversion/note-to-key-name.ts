const KEY_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

/**
 * convert a note number to a key name
 * eg. 69 -> C
 * @param noteNumber 
 * @param quantityOfNotes 
 * @returns 
 */
export const noteNumberToKeyName = (noteNumber:number, quantityOfNotes:number=12):string => KEY_NAMES[noteNumber % quantityOfNotes]

/**
 * convert a letter and an octave to a noteNumber
 * eg. keyAndOctaveAsNoteNumber("C", 4) -> 60
 * @param key - the letter of the note
 * @param octave - the octave of the note
 * @param isAccidental - whether the note is sharp or flat
 * @param quantityOfNotes - the number of notes in the scale
 * @returns the note number
 */ 
export const keyAndOctaveAsNoteNumber = (key:string, octave:number=4, isAccidental:boolean=false, quantityOfNotes:number=12):number => KEY_NAMES.indexOf(key) + (octave * quantityOfNotes) + (isAccidental ? 1 : 0)
