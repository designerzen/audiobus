import AudioCommand from "../audio-command.ts"

/**
 * This is a way to create a musical event
 * that can be sent to other methods in order
 * to control them. This is the backbone of the app
 * and these get sent everywhere that this are valod
 * 
 * This is one of the classic MIDI controls
 * from Note On to Note Off to PitchBend etc.
 */
export default class MIDICommand extends AudioCommand{

    constructor(){
        super()
    }

    /**
     * Start note at
     * @param {Number} noteNumber 
     * @param {Number} velocity 
     * @param {Number} timestamp 
     */
    noteOn( noteNumber, velocity, timestamp ){
        this.number = noteNumber
        this.velocity = velocity
        this.startAt = timestamp
        this.type = "noteOn"
    }
    
    /**
     * End note at
     * @param {Number} noteNumber 
     * @param {Number} timestamp 
     */
    noteOff( noteNumber, timestamp ){
        this.number = noteNumber
        this.endAt = timestamp
        this.type = "noteOff"
    }

    /**
     * Run many times until it is satisfies the 
     * request and returns a boolean if so
     */
    update( timestamp, division ){
        // see if it is time to trigger this command!
        return false
    }

    /**
	 * 
	 * @returns copy of this
	 */
	clone( timestampOffset=0 ){
		const copy:MIDICommand = this.copyAllParametersToCommand( new MIDICommand(this.velocity) )
        copy.noteOn( this.number, this.velocity, timestampOffset  )
        copy.noteOff( this.number, timestampOffset )
        return copy
	}
}
