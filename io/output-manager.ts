import { NOTE_OFF, NOTE_ON } from '../commands'
import OutputAudioEvent from "./events/output-audio-event.ts"

import type { IAudioCommand } from '../audio-command-interface'
import type { IAudioOutput } from "./outputs/output-interface.ts"

export const EVENT_OUTPUTS_UPDATED = "outputsUpdated"

// Each output receives an ordered stream; overlapping notes are held until all
// chains release them. The existing output API identifies voices by pitch.
const owners = new WeakMap<IAudioOutput, Map<string | number, Map<OutputManager, number>>>()
const noteCommands = new WeakMap<IAudioOutput, Map<string | number, IAudioCommand>>()
function sendNote(output: IAudioOutput, command: IAudioCommand): void | Promise<void> {
    if (output.sendCommand) return output.sendCommand(command)
    if (command.type === NOTE_ON) return output.noteOn(command.number, command.velocity ?? 127)
    return output.noteOff(command.number)
}
const pending = new WeakMap<IAudioOutput, Promise<void>>()
function enqueue(output: IAudioOutput, action: () => void | Promise<void>): Promise<void> {
    const next = (pending.get(output) ?? Promise.resolve()).then(action).catch(error => {
        console.error('Output command failed', error)
    })
    pending.set(output, next)
    return next
}

export default class OutputManager extends EventTarget implements IAudioOutput{
	
    async getAvailableFactories() {
        const { getAvailableOutputFactories } = await import('./output-factory')
        return getAvailableOutputFactories()
    }

	static ID:number = 0

	#outputs:IAudioOutput[] = []
    #configurationListeners = new Map<IAudioOutput, () => void>()

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

	get isHidden(): boolean {
		return false
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
		if (this.#outputs.includes(output)) return
		this.#outputs.push(output)
        if (output.sendCommand && output instanceof EventTarget) {
            const changed = () => { owners.delete(output); noteCommands.delete(output) }
            this.#configurationListeners.set(output, changed)
            output.addEventListener('configurationChanged', changed)
        }
		this.dispatchEvent(new CustomEvent(EVENT_OUTPUTS_UPDATED))
	}

	/**
	 * Remove input device
	 * @param output 
	 */
	remove(output:IAudioOutput){
		this.release(output)
        const listener = this.#configurationListeners.get(output)
        if (listener && output instanceof EventTarget) output.removeEventListener('configurationChanged', listener)
        this.#configurationListeners.delete(output)
		this.#outputs = this.#outputs.filter(i => i !== output)
		this.dispatchEvent(new CustomEvent(EVENT_OUTPUTS_UPDATED))
	}

	// Commands for all connected Outputs ---------------------------

	/**
	 * Note ON
	 * @param note 
	 * @param velocity 
	 */
	async noteOn(noteNumber:number, velocity: number): Promise<void>{
		//console.log("noteOn", note, velocity, this.outputs)
		const command:IAudioCommand = {
			number: noteNumber,
			velocity,
			type:NOTE_ON
		}
		// Wait for all outputs to handle noteOn (some may be async)
		await Promise.all(this.#outputs.map(output => this.triggerAudioCommandOnDevice(command, output)))
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
		this.#outputs.forEach(output => { void this.triggerAudioCommandOnDevice(command, output) })
		this.dispatchEvent(new OutputAudioEvent(command))
	}

	/**
	 * All Notes OFF
	 */
	allNotesOff():void{
		this.#outputs.forEach(output => this.release(output))
	}

	/**
	 * Trigger an audio event from an audio command
	 * @param command 
	 * @param output 
	 * @returns 
	 */
	async triggerAudioCommandOnDevice(command:IAudioCommand, output:IAudioOutput):Promise<IAudioCommand>{
        if (!this.#outputs.includes(output)) return command
        if (command.type !== NOTE_ON && command.type !== NOTE_OFF) {
            if (output.sendCommand) await enqueue(output, () => output.sendCommand!(command))
            return command
        }
        if (!Number.isFinite(command.number)) return command
        const key = output.getNoteKey?.(command) ?? command.number
        let stored = noteCommands.get(output)
        if (!stored) noteCommands.set(output, stored = new Map())
        let notes = owners.get(output)
        if (!notes) owners.set(output, notes = new Map())
        let held = notes.get(key)
        if (command.type === NOTE_ON && command.velocity !== 0) {
            if (!held) notes.set(key, held = new Map())
            const first = held.size === 0
            held.set(this, (held.get(this) ?? 0) + 1)
            if (first) {
                stored.set(key, { ...command })
                await enqueue(output, () => sendNote(output, command))
            }
        } else if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)) {
            const count = held?.get(this) ?? 0
            if (count > 1) held!.set(this, count - 1)
            else if (count === 1) {
                held!.delete(this)
                if (held!.size === 0) {
                    notes.delete(key)
                    stored.delete(key)
                    await enqueue(output, () => sendNote(output, { ...command, type: NOTE_OFF, velocity: command.type === NOTE_ON ? 0 : command.velocity }))
                }
            }
        }
		return command
	}

	/**
	 * Triggers any audioCommands and sends' their
	 * command to all registered output devices
	 * @param commands 
	 * @returns 
	 */
	async triggerAudioCommandsOnOutputs(commands: IAudioCommand[]){
		
		await Promise.all(this.#outputs.map( output => 
			Promise.all(commands.map( command => this.triggerAudioCommandOnDevice( command, output ) ))
		))
		
		return commands
	}
	
    private release(output: IAudioOutput): void {
        const notes = owners.get(output)
        notes?.forEach((held, pitch) => {
            if (held.delete(this) && held.size === 0) {
                notes.delete(pitch)
                const original = noteCommands.get(output)?.get(pitch)
                noteCommands.get(output)?.delete(pitch)
                if (original) void enqueue(output, () => sendNote(output, { ...original, type: NOTE_OFF, velocity: 0 }))
            }
        })
    }

    static async settled(output: IAudioOutput): Promise<void> {
        await pending.get(output)
    }

	/**
	 * Kill all output devices
	 * and prevent any further actions
	 */
	destroy(): void {
		this.allNotesOff()
        for (const [output, listener] of this.#configurationListeners) {
            if (output instanceof EventTarget) output.removeEventListener('configurationChanged', listener)
        }
        this.#configurationListeners.clear()
		this.#outputs = []
	}
}


