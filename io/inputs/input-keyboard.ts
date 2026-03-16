/**
 * This is a keyboard adapter
 * that takes key presses and releases
 * and dispatches events with the AudioCommand
 * as the VO that gets passed through the system
 * and one AudioCommand can be created here
 * then piped into the TransformManager for example
 */


import AudioCommand from "../../audio-command.ts"
import AbstractInput from "./abstract-input.ts"
import { addKeyboardDownEvents } from "../../hardware/keyboard/keyboard"
import KeyboardDisplayManager from "../../ui/keyboard-display-manager.ts"
import type { IAudioInput } from "./input-interface.ts"

export const KEYBOARD_INPUT_ID = "Keyboard"

export default class InputKeyboard extends AbstractInput implements IAudioInput{

	#destroyKeyboardListener:Function
	#keyboardDisplayManager:KeyboardDisplayManager | null = null
	
	get name():string {
		return KEYBOARD_INPUT_ID
	}

	get description():string {
		return "QWERTY Keyboard"
	}

	constructor(options:Record<string, any> ={}) { 
		super(options)
		this.onKeyEvent = this.onKeyEvent.bind(this)
		this.#destroyKeyboardListener = addKeyboardDownEvents( this.onKeyEvent )
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		this.#keyboardDisplayManager = new KeyboardDisplayManager()
		const container = document.createElement('div')
		container.className = 'keyboard-input-gui'
		container.appendChild(this.#keyboardDisplayManager.getElement())
		return container
	}

	async destroyGui(): Promise<void> {
		if (this.#keyboardDisplayManager) {
			this.#keyboardDisplayManager.destroy()
			this.#keyboardDisplayManager = null
		}
	}

	override destroy(): void {
		this.destroyGui()
		this.#destroyKeyboardListener()
		this.setAsDisconnected()
	}

	/**
	 * Keyboard key has been pressed
	 * @param commandType 
	 * @param key 
	 * @param value 
	 * @param event 
	 */
	protected onKeyEvent( commandType:string, key:string, value:number, event:KeyboardEvent ) {
		const command = new AudioCommand()
		command.type = commandType
		command.value = value
		command.number = value // noteNumberToFrequency(key)
		command.from = KEYBOARD_INPUT_ID
		command.text = key
		command.startAt = this.now
		command.time = this.now
		this.dispatch( command )
		// console.error(key, {commandType, event, value})
	}
}
