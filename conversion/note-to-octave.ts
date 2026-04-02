/**
 * 
 */
export const noteNumberToOctave = (noteNumber:number, quantityOfNotes:number=12) => Math.floor(noteNumber / quantityOfNotes) - 1
