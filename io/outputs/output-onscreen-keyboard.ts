
import SVGKeyboard from "../../ui/keyboard-svg.ts"

import type { IAudioOutput } from "./output-interface.ts"

export const ONSCREEN_KEYBOARD_OUTPUT_ID = "Onscreen Keyboard"

export default class OutputOnScreenKeyboard implements IAudioOutput{
		
	static ID:number = 0
	
	#uuid:string = "Output-Onscreen-Keyboard-"+(OutputOnScreenKeyboard.ID++)
	#keyboard:SVGKeyboard
	#held = new Map<number, number>()

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
		this.#keyboard = keyboard
	}
	
	noteOn(noteNumber: number, _velocity?: number): void {
		if (_velocity === 0) { this.noteOff(noteNumber); return }
		this.#held.set(noteNumber, (this.#held.get(noteNumber) ?? 0) + 1)
		this.#keyboard.setKeyAsActive(noteNumber)
	}
	noteOff(noteNumber: number): void {
		const count = this.#held.get(noteNumber) ?? 0
		if (count === 0) return
		if (count > 1) { this.#held.set(noteNumber, count - 1); return }
		this.#held.delete(noteNumber)
		this.#keyboard.setKeyAsInactive(noteNumber)
	}
	allNotesOff(): void {
		for (const note of this.#held.keys()) this.#keyboard.setKeyAsInactive(note)
		this.#held.clear()
	}
	destroy(): void { this.allNotesOff() }
}
