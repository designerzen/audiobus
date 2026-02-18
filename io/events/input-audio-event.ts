import { INPUT_EVENT } from '../../commands'
import type { IAudioCommand } from "../../audio-command-interface.ts"

export default class InputAudioEvent extends CustomEvent {
	
	command:IAudioCommand
	
	constructor( audioCommand:IAudioCommand ) {
		super( INPUT_EVENT, { detail: audioCommand } )
		this.command = audioCommand
	}

	clone():InputAudioEvent {
		return new InputAudioEvent( this.command )
	}
}



