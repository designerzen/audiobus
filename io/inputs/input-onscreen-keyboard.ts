
import AbstractInput from "./abstract-input.ts"
import AudioCommand from "../../audio-command.ts"
import { NOTE_OFF, NOTE_ON } from '../../commands'
import SVGKeyboard from "../../ui/keyboard-svg.ts"
import NoteModel from "../../note-model.ts"

import type { IAudioInput } from "./input-interface.ts"

const keyboardKeys = (new Array(128)).fill("")
export const ALL_KEYBOARD_NUMBERS = keyboardKeys.map((_, index) => index )
export const ALL_KEYBOARD_NOTES = keyboardKeys.map((_, index) => new NoteModel(index))

export const ONSCREEN_KEYBOARD_INPUT_ID = "OnscreenKeyboard"

const DEFAULT_OPTIONS = {
	keys:ALL_KEYBOARD_NOTES,
	container:"#onscreen-keyboard"
}

export default class InputOnScreenKeyboard extends AbstractInput implements IAudioInput{
	
	#keyboard:SVGKeyboard
	private guiNotice: HTMLElement | null = null
	keyboardElement:HTMLElement | null = null

	get name():string {
		return ONSCREEN_KEYBOARD_INPUT_ID
	}

	get description():string {
		return "Onscreen Keyboard"
	}

	get keyboard():SVGKeyboard{
		return this.#keyboard
	}

	get isHidden(): boolean {
		return false
	}

	constructor( options:Record<string, any> = DEFAULT_OPTIONS ) { 
		super({...DEFAULT_OPTIONS,...options})
		const savedKeys = this.options.keys
		// Older workspaces serialized NoteModel instances as null array entries.
		const notes = Array.isArray(savedKeys) && savedKeys.length > 0 && savedKeys.every(key =>
			key != null && Number.isInteger(key.noteNumber) && key.noteNumber >= 0 && key.noteNumber < 128
		) ? savedKeys : ALL_KEYBOARD_NOTES
		// Keep plain data in options, including the NoteModel prototype getters.
		const keys = notes.map(key => ({ ...key, noteNumber: key.noteNumber, colour: key.colour }))
		this.options.keys = keys
		this.onKeyDown = this.onKeyDown.bind(this)
		this.onKeyUp = this.onKeyUp.bind(this)
		this.#keyboard = new SVGKeyboard(keys, this.onKeyDown, this.onKeyUp)
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		this.keyboardElement = this.#keyboard.asElement
		if (this.options.container)
		{
			// inject into DOM on specified element 
			const container = document.querySelector(this.options.container)
			if (container) {
				container.appendChild(this.keyboardElement)
				// Graph views move the returned GUI into their own card. Keep the piano
				// in its configured container and give the card a separate element.
				this.guiNotice ??= document.createElement('p')
				this.guiNotice.textContent = 'Play using the onscreen keyboard.'
				return this.guiNotice
			}
		}

		return this.keyboardElement
	}

	async destroyGui(): Promise<void> {
		this.#keyboard.allNotesOff()
		this.#keyboard.asElement.remove()
		this.guiNotice?.remove()
		this.keyboardElement = null
	}
	
	/**
	 * KILL
	 */
	override destroy(): void {
		this.#keyboard.destroy()
		this.guiNotice?.remove()
		this.keyboardElement = null
		this.setAsDisconnected()
	}

	/**
	 * 
	 * @param noteNumber 
	 * @param velocity 
	 */
	onKeyDown(noteNumber:number, pressure:number){
		const command:AudioCommand = new AudioCommand()
		command.type = NOTE_ON
		// The keyboard reports pointer pressure (0–1); commands use MIDI velocity.
		command.velocity = Math.round(Math.max(0, Math.min(1, pressure)) * 127)
		command.number = noteNumber
		command.from = ONSCREEN_KEYBOARD_INPUT_ID
		command.startAt = this.now
		command.time = this.now
		this.dispatch( command )
	}

	/**
	 * 
	 * @param noteNumber 
	 * @param velocity 
	 */
	onKeyUp(noteNumber:number, velocity:number){
		const command:AudioCommand = new AudioCommand()
		command.number = noteNumber
		command.type = NOTE_OFF
		command.velocity = velocity
		command.from = ONSCREEN_KEYBOARD_INPUT_ID
		command.startAt = this.now
		command.time = this.now
		this.dispatch( command )
	}
}



