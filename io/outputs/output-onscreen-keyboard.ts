
import SVGKeyboard from "../../ui/keyboard-svg.ts"
import { convertNoteNumberToColour } from "../../conversion/note-to-colour.ts"

import type { IAudioOutput } from "./output-interface.ts"

export const ONSCREEN_KEYBOARD_OUTPUT_ID = "Onscreen Keyboard"

export default class OutputOnScreenKeyboard implements IAudioOutput{
		
	static ID:number = 0
	
	#uuid:string
	#keyboard:SVGKeyboard

	get uuid(): string {
		return this.#uuid
	}

	get name():string {
		return ONSCREEN_KEYBOARD_OUTPUT_ID
	}

	get description():string {
		return "Onscreen Keyboard"
	}

	get keyboard():SVGKeyboard{
		return this.#keyboard
	}

	get isConnected(): boolean {
		return !!this.#keyboard
	}
	
	// we only hide the output but the input is set
	get isHidden(): boolean {
		return true
	}


	constructor( keyboard:SVGKeyboard ) { 
		this.#uuid = "Output-Onscreen-Keyboard-"+(OutputOnScreenKeyboard.ID++)
		this.#keyboard = keyboard
	}
	
	noteOn(noteNumber: number, velocity: number): void {
		this.#keyboard.setKeyAsActive(noteNumber)
	}
	noteOff(noteNumber: number): void {
		this.#keyboard.setKeyAsInactive(noteNumber)
	}
	allNotesOff(): void {
		this.#keyboard.allNotesOff()
	}
}
