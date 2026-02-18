import { OUTPUT_EVENT, NOTE_OFF, NOTE_ON } from '../commands'
import OutputAudioEvent from "./events/output-audio-event.ts"

import type { IAudioOutput } from "./outputs/output-interface.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"

export const EVENT_OUTPUTS_UPDATED = "outputsUpdated"

export default class OutputManager extends EventTarget implements IAudioOutput{
	
	static ID:number = 0

	#outputs:IAudioOutput[] = []

	get uuid():string{
		return "OutputManager-" + OutputManager.ID
	}

	get outputs():IAudioOutput[] {
		return this.#outputs
	}

	get name():string {
		return "OutputManager"
	}

	get description():string {
		return "Manages all connected audio outputs"
	}

	get isConnected(): boolean {
		return true
	}

	constructor(){
		super()
		OutputManager.ID++
	}
	
	// connect?(): Promise<Function> | Function {
	// 	throw new Error("Method not implemented.")
	// }
	// disconnect?(): Promise<void> | Function {
	// 	throw new Error("Method not implemented.")
	// }

	/**
	 * After creating an instance of an input device
	 * add it here to monitor it's outputs via the event dispatcher
	 * @param output 
	 */
	add(output:IAudioOutput){
		this.#outputs.push(output)
		this.dispatchEvent(new CustomEvent(EVENT_OUTPUTS_UPDATED))
	}

	/**
	 * Remove input device
	 * @param output 
	 */
	remove(output:IAudioOutput){
		this.#outputs = this.#outputs.filter(i => i !== output)
		this.dispatchEvent(new CustomEvent(EVENT_OUTPUTS_UPDATED))
	}

	// Commands for all connected Outputs ---------------------------

	/**
	 * Note ON
	 * @param note 
	 * @param velocity 
	 */
	noteOn(noteNumber:number, velocity: number): void{
		//console.log("noteOn", note, velocity, this.outputs)
		const command:IAudioCommand = {
			number: noteNumber,
			velocity,
			type:NOTE_ON
		}
		this.#outputs.forEach(output => output.noteOn(noteNumber, velocity))
		this.dispatchEvent( new OutputAudioEvent(command) )
	}

	/**
	 * Note OFF
	 * @param note 
	 */
	noteOff(noteNumber:number): void{
		const command:IAudioCommand = {
			number: noteNumber,
			type:NOTE_OFF
		}
		//console.log("noteOff", note, velocity, this.outputs)
		this.#outputs.forEach(output => output.noteOff(noteNumber))
		this.dispatchEvent(new OutputAudioEvent(command))
	}

	/**
	 * All Notes OFF
	 */
	allNotesOff():void{
		this.#outputs.forEach(output => output.allNotesOff())
	}

	/**
	 * Trigger an audio event from an audio command
	 * @param command 
	 * @param output 
	 * @returns 
	 */
	triggerAudioCommandOnDevice(command:IAudioCommand, output:IAudioOutput):IAudioCommand{
		//console.info("OutputManager", {command, output})
		if (!Number.isFinite(command.number)) {
			console.warn("[OutputManager] Invalid note number in command", command)
			return command
		}
		switch (command.type) {
			case NOTE_ON:
				output.noteOn( command.number, command.velocity)
				break

			case NOTE_OFF:
				output.noteOff( command.number)
				break

			default:
				console.info("NOT IMPLEMENTED: Audio Command", command.type)
		}
		return command
	}

	/**
	 * Triggers any audioCommands and sends' their
	 * command to all registered output devices
	 * @param commands 
	 * @returns 
	 */
	triggerAudioCommandsOnOutputs(commands: IAudioCommand[]){
		
		this.#outputs.forEach( output => {
			commands.forEach( command => this.triggerAudioCommandOnDevice( command, output ) )
		})
		
		return commands
	}
	
	/**
	 * Kill all output devices
	 * and prevent any further actions
	 */
	destroy(): void {
		this.#outputs = []
	}
}


