/**
 * Scrolling note on / off visualisation
 */

import NOTE_VISUALISER_CANVAS_WORKER from "./note-visualiser-worker.js?worker"
import { AbstractResizeable } from "./abstract-resizeable-canvas.ts"
import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import type NoteModel from "../note-model.ts"
import { convertNoteNumberToColour } from '../conversion/note-to-colour'

export default class NoteVisualiser extends AbstractResizeable implements IAudioOutput {

	static ID:number = 0

    notes:NoteModel[]
    canvas:HTMLCanvasElement
    context:CanvasRenderingContext2D | null = null

    counter:number = 0
    notesOn:number = 0

    started:boolean = false
    mouseDown:boolean = false
    wave:boolean = false
    vertical:boolean = false

    mouseX:number = 0
    mouseY:number = 0
    private interactions = new AbortController()
    private observer: ResizeObserver
    private controls: HTMLDivElement

	#uuid:string = "Output-Note-Visualiser-"+(NoteVisualiser.ID++)
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

	get isConnected(): boolean {
		return this.worker !== null
	}

	get isHidden(): boolean {
		return false
	}

    constructor( notes:NoteModel[], canvas:HTMLCanvasElement, vertical:boolean=false, wave:number=0 ){
        super(canvas, NOTE_VISUALISER_CANVAS_WORKER, {vertical, notes})
		this.notes = notes
        this.canvas = canvas
        this.wave = wave > 0 ? true : false
        this.vertical = vertical
        const signal = this.interactions.signal
        canvas.tabIndex = 0
        canvas.setAttribute('aria-label', 'Note timeline. Arrow keys scroll, plus and minus zoom, Home follows live notes.')
        canvas.title = 'Drag to pan · Scroll for pitches · Shift+scroll for time · Ctrl+scroll to zoom'
        this.controls = document.createElement('div')
        this.controls.className = 'note-timeline-controls'
        for (const [label, payload] of [
            ['Zoom out', { type: 'zoom', factor: .8, className:'btn-zoom-out' }],
            ['Zoom in', { type: 'zoom', factor: 1.25, className:'btn-zoom-in' }],
            ['Follow live', { type: 'follow', className:'btn-follow' }],
        ] as const) {
            const button = document.createElement('button')
            button.type = 'button'
			button.textContent = label
            button.classList.add(`btn-${payload.type}`, payload.className )
            button.addEventListener('click', () => this.worker.postMessage(payload), { signal })
            this.controls.append(button)
        }
        const hint = document.createElement('span')
        hint.textContent = canvas.title
        this.controls.append(hint)
        canvas.before(this.controls)
        const pan = (x: number, y: number) => this.worker.postMessage({ type: 'pan', x, y })
        canvas.addEventListener('wheel', event => {
            event.preventDefault()
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
            if (event.ctrlKey || event.metaKey) {
                const rect = canvas.getBoundingClientRect()
                this.worker.postMessage({ type: 'zoom', factor: Math.exp(-event.deltaY * unit * .002), anchor: (event.clientX - rect.left) / rect.width })
            } else pan((event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit, event.shiftKey ? 0 : -event.deltaY * unit)
        }, { signal, passive: false })
        canvas.addEventListener('pointerdown', event => {
            if (event.button !== 0) return
            this.mouseDown = true
            this.mouseX = event.clientX
            this.mouseY = event.clientY
            canvas.setPointerCapture(event.pointerId)
            canvas.focus({ preventScroll: true })
        }, { signal })
        canvas.addEventListener('pointermove', event => {
            if (!this.mouseDown) return
            pan(this.mouseX - event.clientX, event.clientY - this.mouseY)
            this.mouseX = event.clientX
            this.mouseY = event.clientY
        }, { signal })
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            canvas.addEventListener(type, () => { this.mouseDown = false }, { signal })
        }
        canvas.addEventListener('keydown', event => {
            const movements: Record<string, [number, number]> = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, 42], ArrowDown: [0, -42] }
            if (event.key in movements) pan(...movements[event.key] as [number, number])
            else if (['+', '=', '-'].includes(event.key)) this.worker.postMessage({ type: 'zoom', factor: event.key === '-' ? .8 : 1.25 })
            else if (event.key === 'Home') this.worker.postMessage({ type: 'follow' })
            else return
            event.preventDefault()
        }, { signal })
        this.observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            if (width && height) this.worker.postMessage({ type: 'resize', displayWidth: Math.round(width), displayHeight: Math.round(height) })
        })
        this.observer.observe(canvas)
    }

    /**
     * Note On
     * @param {Number} noteNumber 
     * @param {number} velocity 
     */
    noteOn( noteNumber:number, velocity=1, colour=convertNoteNumberToColour(noteNumber) ){
        const payload = { type:"noteOn", note:noteNumber,colour, velocity, time: performance.timeOrigin + performance.now() }
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
        this.worker.postMessage({ type:"noteOff",  note:noteNumber, colour, velocity, time: performance.timeOrigin + performance.now() })
    }

	/**
	 * 
	 */
	allNotesOff(): void {
		this.notesOn = 0
		this.worker.postMessage({ type:"allNotesOff", time: performance.timeOrigin + performance.now() })
	}

    destroy() {
        this.interactions.abort()
        this.observer.disconnect()
        this.controls.remove()
        this.worker.terminate()
    }
}
