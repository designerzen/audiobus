/**
 * 
 */
import InputAudioEvent from "../events/input-audio-event.ts"
import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"

const DEFAULT_OPTIONS:Record<string, any> = {
	now: () => performance.now()
}

export default abstract class AbstractInput extends EventTarget implements IAudioInput{
	
	/**
	 * @property {Function} parameterDescriptors Get the custom parameters of the processor.
	 *
	 * @returns {AudioParamDescriptor[]}
	
	static get parameterDescriptors() {
		return []
	}
	*/

    static ID:number = 0

    static getUniqueID( name: string ) {
		return `input-${name}-${ String(AbstractInput.ID++) }`
    }

	#uuid: string = AbstractInput.getUniqueID( this.name )
	#options:Record<string, any>
	#connected:boolean = false

	get uuid():string{
		return this.#uuid
	}

	get name():string {
		return "InputDevice"
	}

	get description():string {
		return "Abstract input device"
	}

	get options():Record<string, any> {
		return this.#options
	}

	get isConnected():boolean {
		return this.#connected
	}

	get now():number {
		return this.#options?.now() ?? performance.now
	}

	constructor(options:Record<string, any> = DEFAULT_OPTIONS) {
		super()
		this.#options = {...DEFAULT_OPTIONS, ...options}
	}

	// createGui?(): Promise<HTMLElement> {
	// 	throw new Error("Method not implemented.")
	// }
	// destroyGui?(): Promise<void> {
	// 	throw new Error("Method not implemented.")
	// }

	/**
	 * Overwrite these as applicable
	 * @returns 
	 */
	hasAudioInput(): boolean {
		return false
	}
	hasMidiInput(): boolean {
		return false
	}
	hasAutomationInput(): boolean {
		return false
	}
	hasMpeInput(): boolean {
		return false
	}
	hasOscInput(): boolean {
		return false
	}
	hasSysexInput(): boolean {
		return false
	}

	setAsConnected():void{
		this.#connected = true
	}
	
	setAsDisconnected():void{
		this.#connected = false
	}

	dispatch(command:IAudioCommand):void {
		const event:InputAudioEvent = new InputAudioEvent( command )
		this.dispatchEvent( event )
	}

	destroy():void{
		throw new Error("AbstractInput::destroy() must be implemented in subclasses.")
	}
}
