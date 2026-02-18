/**
 * Scrolling note on / off visualisation
 */

import NOTE_VISUALISER_CANVAS_WORKER from "./note-visualiser-worker.js?url"
import { AbstractResizeable } from "./abstract-resizeable-canvas.ts"
import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import type { CanvasHTMLAttributes } from "react"
import type NoteModel from "../note-model.ts"

export default class NoteVisualiser extends AbstractResizeable implements IAudioOutput {

	static ID:number = 0

    notes:NoteModel[]
    canvas:HTMLCanvasElement
    context:CanvasRenderingContext2D

    height:number

    counter:number = 0
    notesOn:number = 0

    started:boolean = false
    mouseDown:boolean = false
    wave:boolean = false
    vertical:boolean = false

    mouseX:number = 0
    mouseY:number = 0

	#uuid:string
    #blendMode:number = 23

    set blendMode(value:number){
        this.#blendMode = value
        // console.error("Blendmode requested", value)
    }

    get blendMode():number{
        return this.#blendMode
    }

    get backgroundColour(){
        return getComputedStyle(this.canvas).getPropertyValue("background-color")
        return this.canvas.style.backgroundColor
    }

	get uuid(): string {
		return this.#uuid
	}
	
	get name(): string {
		return "Note Visualiser"
	}
	
	get description(): string {
		return "Visualises note data as bars on a timeline"
	}

    constructor( notes:NoteModel[], canvas:HTMLCanvasElement, vertical:boolean=false, wave:number=0 ){
        super(canvas, NOTE_VISUALISER_CANVAS_WORKER, {vertical, notes})
		this.#uuid = "Output-Note-Visualiser-"+(NoteVisualiser.ID++)		
        this.notes = notes
        this.canvas = canvas
        this.wave = wave
        this.vertical = vertical
    }

    /**
     * Note On
     * @param {Number} noteNumber 
     * @param {number} velocity 
     */
    noteOn( noteNumber:number, velocity=1, colour='#fff' ){
        const payload = { type:"noteOn", note:noteNumber,colour, velocity }
        // console.info("NOTEVIZ noteOn", {note, velocity, payload} )
        this.notesOn++
        this.worker.postMessage(payload)
    }

    /**
     * Note Off
     * @param {Number} note 
     * @param {Number} velocity 
     */
    noteOff( noteNumber:number, velocity=1, colour='#fff' ){
        this.notesOn--
        this.worker.postMessage({ type:"noteOff",  note:noteNumber, colour, velocity })
    }

	/**
	 * 
	 */
	allNotesOff(): void {
		this.notesOn = 0
		this.worker.postMessage({ type:"allNotesOff" })
	}
}
