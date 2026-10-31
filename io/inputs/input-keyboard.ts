/**
 * This is a keyboard adapter
 * that takes key presses and releases
 * and dispatches events with the AudioCommand
 * as the VO that gets passed through the system
 * and one AudioCommand can be created here
 * then piped into the TransformManager for example
 */

import AudioCommand from "../../audio-command.ts"
import { NOTE_ON } from "../../commands"
import AbstractInput from "./abstract-input.ts"
import { addKeyboardDownEvents } from "../../hardware/keyboard/keyboard"
import KeyboardDisplayManager from "../../ui/keyboard-display-manager.ts"
import type { IAudioInput } from "./input-interface.ts"
import {
	keyboardConfiguration,
	type KeyboardConfiguration
} from "../../hardware/keyboard/keyboard-configuration"
import { createKeyboardSettings } from "../../ui/keyboard-settings"
import { EVENT_CONFIGURATION_CHANGED } from "../../event-constants"

export const KEYBOARD_INPUT_ID = "Keyboard"

export default class InputKeyboard extends AbstractInput implements IAudioInput {
	#destroyKeyboardListener: Function
	#keyboardDisplayManager: KeyboardDisplayManager | null = null
	#destroySettings: (() => void) | null = null

	get configuration(): KeyboardConfiguration {
		return keyboardConfiguration(this.options)
	}

	setConfiguration(configuration: KeyboardConfiguration): void {
		this.#destroyKeyboardListener()
		Object.assign(this.options, keyboardConfiguration(configuration))
		this.#destroyKeyboardListener = addKeyboardDownEvents(
			this.onKeyEvent,
			undefined,
			this.configuration
		)
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	get name(): string {
		return KEYBOARD_INPUT_ID
	}

	get description(): string {
		return "QWERTY Keyboard"
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.onKeyEvent = this.onKeyEvent.bind(this)
		Object.assign(this.options, this.configuration)
		this.#destroyKeyboardListener = addKeyboardDownEvents(
			this.onKeyEvent,
			undefined,
			this.configuration
		)
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		await this.destroyGui()
		this.#keyboardDisplayManager = new KeyboardDisplayManager()
		const container = document.createElement("div")
		container.className = "keyboard-input-gui"
		const settings = document.createElement("div")
		settings.className = "keyboard-input-settings"
		this.#destroySettings = createKeyboardSettings(
			settings,
			() => this.configuration,
			(configuration) => this.setConfiguration(configuration)
		)
		container.appendChild(settings)
		container.appendChild(this.#keyboardDisplayManager.getElement())
		return container
	}

	async destroyGui(): Promise<void> {
		this.#destroySettings?.()
		this.#destroySettings = null
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
	 * @param _event
	 */
	protected onKeyEvent(commandType: string, key: string, value: number, _event?: KeyboardEvent) {
		const command = new AudioCommand()
		command.type = commandType
		command.velocity = commandType === NOTE_ON ? 127 : 0
		command.value = value
		command.number = value // noteNumberToFrequency(key)
		command.from = KEYBOARD_INPUT_ID
		command.text = key
		command.startAt = this.now
		command.time = this.now
		this.dispatch(command)
		// console.error(key, {commandType, event, value})
	}
}