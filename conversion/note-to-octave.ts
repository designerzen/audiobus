/**
 * Tonic
 * Supertonic
 * Mediant
 * Subdominant
 * Dominant
 * Submediant
 * Leading Tone
 * Sub-Tonic
 * 
 * Charles Goes Dancing At Every Big Fun Celebration.
 * From G D A E B...
 * 
 */
export const noteNumberToOctave = (noteNumber:number, quantityOfNotes:number=12) => Math.floor(noteNumber / quantityOfNotes) - 1
