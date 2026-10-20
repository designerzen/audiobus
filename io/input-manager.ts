import { EVENT_INPUTS_UPDATED, EVENT_CONFIGURATION_CHANGED, EVENT_CONNECTION_CHANGED, EVENT_DEVICE_LIST_CHANGED } from '../event-constants.ts'
export { EVENT_INPUTS_UPDATED } from '../event-constants.ts'
/**
 * Combine input mechanisms and dispatch
 * directly from this instance. Allows
 * for the addition of many input devices
 * with just one single entry point
 */

import { INPUT_EVENT } from '../commands'
import AbstractInput from "./inputs/abstract-input"
import type InputAudioEvent from "./events/input-audio-event"
import { refreshMidiDeviceProfiles } from '../midi/hardware/device-profiles'



export default class InputManager extends AbstractInput {
	
    async getAvailableFactories() {
        await refreshMidiDeviceProfiles()
        const { getAvailableInputFactories } = await import('./input-factory')
        return getAvailableInputFactories()
    }

	#inputs:AbstractInput[] = []
    #disabled = new Set<AbstractInput>()

    isEnabled(input: AbstractInput): boolean { return !this.#disabled.has(input) }

    setEnabled(input: AbstractInput, enabled: boolean): void {
        if (!this.#inputs.includes(input) || enabled === this.isEnabled(input)) return
        if (enabled) this.#disabled.delete(input)
        else this.#disabled.add(input)
        this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))
    }
	#inputMap:Map = new Map()
	#abortController:AbortController
    #inputChanged = () => this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))

	get inputs():AbstractInput[] {
		return this.#inputs
	}
	
	constructor(options={}) { 
		super(options)
		this.onAudioInputEvent = this.onAudioInputEvent.bind(this)
		this.#abortController = new AbortController()
	}

	/**
	 * After creating an instance of an input device
	 * add it here to monitor it's outputs via the event dispatcher
	 * @param input 
	 */
	add(input:AbstractInput){
		if (this.#inputs.includes(input)) return
		this.#inputs.push(input)
		this.#inputMap.set(input.name, input)
		input.addEventListener(INPUT_EVENT, this.onAudioInputEvent, { signal:this.#abortController.signal } )
        for (const type of [EVENT_CONFIGURATION_CHANGED, EVENT_CONNECTION_CHANGED, EVENT_DEVICE_LIST_CHANGED]) {
            input.addEventListener(type, this.#inputChanged, { signal: this.#abortController.signal })
        }

		this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))
	}

	/**
	 * Remove input device
	 * @param input 
	 */
	remove(input:AbstractInput){
        this.#disabled.delete(input)
		this.#inputs = this.#inputs.filter(i => i !== input)
		this.#inputMap.delete(input.name)
		input.removeEventListener(INPUT_EVENT, this.onAudioInputEvent )
        for (const type of [EVENT_CONFIGURATION_CHANGED, EVENT_CONNECTION_CHANGED, EVENT_DEVICE_LIST_CHANGED]) input.removeEventListener(type, this.#inputChanged)
		this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))
	}

	getInput(name:string):AbstractInput{
		return this.#inputMap.get(name)
	}

	/**
	 * Kill all input devices
	 */
	destroy(): void {
		this.#disabled.clear()
		this.#abortController.abort()
		this.#inputMap.clear()
		this.#inputs = []
	}

	/**
	 * Proxy events from input devices
	 * and streamline them all through this
	 * single dispatcher
	 * @param event 
	 */
	onAudioInputEvent(event:InputAudioEvent):void{
        if (this.#disabled.has(event.target as AbstractInput)) return
		//console.info("InputManager::onAudioInputEvent", event)
		// kill existing event
		event.preventDefault()
		// create a clone and dispatch
		const clone:InputAudioEvent = event.clone()
		this.dispatchEvent(clone)
	}
}


