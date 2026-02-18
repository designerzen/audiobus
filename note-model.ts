import { convertNoteNumberToColour } from "./conversion/note-to-colour.ts"
import { noteNumberToFrequency } from "./conversion/note-to-frequency.ts"
import { noteNumberToKeyName } from "./conversion/note-to-key-name.ts"
import { noteNumberToOctave } from "./conversion/note-to-octave.ts"

const SOUNDS_SOLFEGE = ["Do","Do #","Re","Re #","Mi","Fa","Fa #","Sol","Sol #","La","La #","Si"]

// const SHARPS = [1,3,6,8,10]
const SHARPS = [false, true, false, true, false, false, true, false, true, false, true, false]

export const QUANTITY_NOTES = 12
export const isSharp = (noteNumber:number) => SHARPS[noteNumber % QUANTITY_NOTES] 
export const isFlat = (noteNumber:number) => isSharp(noteNumber)

export default class NoteModel{

    // noteName
	// noteNumber
    // noteKey 
	// frequency
	// octave
    // accidental
    // sound
    // alternate

    detune:number = 0

    sequenceIndex: number
    number: number
    noteKey: string
    octave: number
    noteName: string
    frequency: number
    accidental: boolean
    sound: string
    alternate: any
        
    get colour():string{
        return convertNoteNumberToColour( this.number )
    }
	
    set noteNumber(noteNumber:number){
        this.number = noteNumber
        this.sequenceIndex = noteNumber % QUANTITY_NOTES
        this.noteKey =  noteNumberToKeyName( noteNumber, QUANTITY_NOTES )  
        this.octave = noteNumberToOctave( noteNumber, QUANTITY_NOTES )
        this.noteName =  this.noteKey + this.octave
        this.frequency = noteNumberToFrequency( noteNumber, QUANTITY_NOTES )
        this.accidental = isSharp( noteNumber )
        this.sound = SOUNDS_SOLFEGE[noteNumber % SOUNDS_SOLFEGE.length]
        this.alternate = this.accidental ? 
            noteNumberToKeyName( noteNumber + 1, QUANTITY_NOTES ) + " Flat"  :
            this.noteName 
    }

    get noteNumber():number{
        return this.number
    }

    constructor( noteNumber:number ){
       this.noteNumber = noteNumber
    }

    toString():string{
        return "[Note: "+this.noteNumber+" key:"+this.noteKey+"  octave:" + this.octave + " sound:" + this.sound+"  ] Freq:"+ this.frequency
    }

    clone():NoteModel{
        return new NoteModel( this.noteNumber )
    }
}
