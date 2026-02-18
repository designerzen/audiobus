/**
 * Combine input mechanisms and dispatch
 * directly from this instance. Allows
 * for the addition of many input devices
 * with just one single entry point
 */

import { INPUT_EVENT } from '../commands'
import AbstractInput from "./inputs/abstract-input"
import type InputAudioEvent from "./events/input-audio-event"

export const EVENT_INPUTS_UPDATED = "EVENT_INPUTS_UPDATED"

export default class InputManager extends AbstractInput {
	
	#inputs:AbstractInput[] = []
	#inputMap:Map = new Map()
	#abortController:AbortController

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
		this.#inputs.push(input)
		this.#inputMap.set(input.name, input)
		input.addEventListener(INPUT_EVENT, this.onAudioInputEvent, { signal:this.#abortController.signal } )

		this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))
	}

	/**
	 * Remove input device
	 * @param input 
	 */
	remove(input:AbstractInput){
		this.#inputs = this.#inputs.filter(i => i !== input)
		this.#inputMap.delete(input.name)
		input.removeEventListener(INPUT_EVENT, this.onAudioInputEvent )
		this.dispatchEvent(new Event(EVENT_INPUTS_UPDATED))
	}

	getInput(name:string):AbstractInput{
		return this.#inputMap.get(name)
	}

	/**
	 * Kill all input devices
	 */
	destroy(): void {
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
		//console.info("InputManager::onAudioInputEvent", event)
		// kill existing event
		event.preventDefault()
		// create a clone and dispatch
		const clone:InputAudioEvent = event.clone()
		this.dispatchEvent(clone)
	}
}


