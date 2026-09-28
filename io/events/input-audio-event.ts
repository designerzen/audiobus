import { INPUT_EVENT } from '../../commands'
import type { IAudioCommand } from "../../audio-command-interface.ts"

export default class InputAudioEvent extends CustomEvent {
	
	command:IAudioCommand
	readonly origin: object
	
	constructor( audioCommand:IAudioCommand, origin: object = {} ) {
		super( INPUT_EVENT, { detail: audioCommand } )
		this.command = audioCommand
		this.origin = origin
	}

	clone():InputAudioEvent {
		return new InputAudioEvent( Object.assign(Object.create(Object.getPrototypeOf(this.command)), structuredClone(this.command)), this.origin )
	}
}



