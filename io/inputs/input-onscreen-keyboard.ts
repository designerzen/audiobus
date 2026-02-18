
import AbstractInput from "./abstract-input.ts"
import AudioCommand from "../../audio-command.ts"
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from '../../commands'
import SVGKeyboard from "../../ui/keyboard-svg.ts"
import NoteModel from "../../note-model.ts"

import type { IAudioInput } from "./input-interface.ts"

const keyboardKeys = (new Array(128)).fill("")
export const ALL_KEYBOARD_NUMBERS = keyboardKeys.map((_, index) => index )
export const ALL_KEYBOARD_NOTES = keyboardKeys.map((keyboardKeys, index) => new NoteModel(index))

export const ONSCREEN_KEYBOARD_INPUT_ID = "OnscreenKeyboard"

const DEFAULT_OPTIONS = {
	keys:ALL_KEYBOARD_NOTES,
	container:"#onscreen-keyboard"
}

export default class InputOnScreenKeyboard extends AbstractInput implements IAudioInput{
	
	#keyboard:SVGKeyboard
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
		const keys = this.options.keys
		this.onKeyDown = this.onKeyDown.bind(this)
		this.onKeyUp = this.onKeyUp.bind(this)
		this.#keyboard = new SVGKeyboard(keys, this.onKeyDown, this.onKeyUp)
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		if (this.options.container)
		{
			// inject into DOM on specified element 
			const container = document.querySelector(this.options.container)
			this.keyboardElement = container.appendChild( this.#keyboard.element )
			return this.keyboardElement
		}

		return this.#keyboard.element
	}

	async destroyGui(): Promise<void> {
		if( this.#keyboard.element !== null ) {
			this.#keyboard.element.remove()
		}
		return Promise.resolve()
	}
	
	/**
	 * KILL
	 */
	override destroy(): void {
		this.#keyboard.allNotesOff()
		this.setAsDisconnected()
	}

	/**
	 * 
	 * @param noteNumber 
	 * @param velocity 
	 */
	onKeyDown(noteNumber:number, velocity:number){
		const command:AudioCommand = new AudioCommand()
		command.type = NOTE_ON
		command.velocity = velocity
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



