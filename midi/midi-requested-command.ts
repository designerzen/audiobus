/**
 * This is a way to create an event that is scheduled for the future
 * 
 */

import type NoteModel from "../note-model.ts"
import MIDICommand from "./midi-command.ts"

export default class MIDIRequestedCommand extends MIDICommand{

    // only update this when it is a modulo of this
    #snap = 1

    // 
    #event:NoteModel

    constructor( noteEvent ){
        super()
        this.#event = noteEvent
    }

    /**
     * Check to see if this 
     * @param timestamp {Number}
     * @param division {Number}
     * @returns {Boolean}
     */
    update( timestamp:number, division:number=0 )
    {
        const remaining = timestamp - (this.startAt ?? 0)
        // compare timestamps and see if this is scheduled to have already begun
        if (remaining > 0)
        {
            // console.info("This should have begun!", remaining)
            if (division % this.#snap === 0)
            {
                // trigger!
                return true
            }else{
                console.info("waiting for snap", remaining, division, this.#snap )
            }

        }else{
            // console.info("still waiting for musical event", remaining)
        }

        return super.update(timestamp, division)
    }

    /**
     * Clone this Event
     * @param timestampOffset 
     * @returns 
     */
    clone( timestampOffset:number=0 ):MIDIRequestedCommand{
		const copy = this.copyAllParametersToCommand( new MIDIRequestedCommand(this.#event  ) )
        copy.noteOn( this.number, this.velocity, timestampOffset  )
        copy.noteOff( this.number, timestampOffset )
        return copy
	}
}
