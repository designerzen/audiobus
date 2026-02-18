/**
 * An Audio Event is an Audio Command that has 
 * completed or been "triggered". This is useful
 * for simplifying the connection between request
 * and response.
 * 
 */
import type { IAudioCommand } from "./audio-command-interface.ts"
import AudioCommand from "./audio-command.ts"
import type Timer from "./timing/timer.ts"

export default class AudioEvent extends AudioCommand implements IAudioCommand { 

	get duration():number{
        // fallback to always having *some* duration
		return this.endAt ? this.endAt - this.time : 0.1
	}

    constructor( audioCommand:IAudioCommand, time:number ) {
        super()
        this.copyAllParametersFromCommand( audioCommand )
        this.trigger( time )
    }

    /**
     * Make this Audio Command make music in a Audio Device    
     * 
     */
    trigger( timestamp:number ){
        this.startAt = timestamp
    }
}
