import type { IAudioCommand } from "./audio-command-interface"

/**
* A single musical command.
* 
* This can be used to send a command to any part
* of the audio application in order to trigger something
* or change parameters.
* 
* Essentially this is a musical event which hasn't been
* triggered yet and can be scheduled using startAt in the
* future.
* 
* This is based on the MIDI protocol and uses the same nomenclature
*/
export default class AudioCommand implements IAudioCommand {

	static counter = 1

    get noteNumber():number{
        return this.number
    }

	// pitch value 0 -> 16383
	get pitch():number{
		return this.value
	}
	
	// MIDI GM Note number for setting pitch
    number:number = 0

	// UNOFFICAl: Used for MIDI channelling (can be transformed too)
    channel:number = -1	// all

	// velocity / amplitude value
    velocity:number = 0
    startAt:number = 0
    endAt:number = 0

	// pitch value from MIDI is 0 -> 16383
	value:number = 0
	pitchBend:number = 0

	// UNOFFICAl: Uint8Array
	raw:Uint8Array = new Uint8Array()
	// data:

	// these are both in the MIDI spec and relate to different things confusingly
	time:number = 0
	timeCode:number = 0

	// Handy places to store information about this command
	id:string = "C-" + AudioCommand.counter++
	// Note Event / Transport Event etc.
	type:string = ""
	// Note On / Note Off etc.
	subtype:string = ""

	text:string = ""

	// CUSTOM (UNOFFICAl) : 
	// which device created this command (e.g. "MIDI", "OSC", "WebRTC")
	from:string = "Unknown"
	patch:number = 0

	// for linked lists
	previous:IAudioCommand = undefined
	next:IAudioCommand = undefined

	constructor() {}

	remove(){
		if (this.previous)
		{
			this.previous.next = this.next
		}
		if (this.next)
		{
			this.next.previous = this.previous
		}
	}

	append(tail:AudioCommand){
		tail.next = this
		this.previous = tail
	}

	/**
	 * IAudioCommand:clone
	 * @returns copy of this
	 */
	clone():IAudioCommand{
		return this.copyAllParametersToCommand( new AudioCommand() )
	}

	/**
	 *  IAudioCommand:destroy
	 */
	destroy():void{
		this.remove()
	}

	copyAllParametersToCommand(command:AudioCommand):AudioCommand{
		for (let i in this)
		{
			if (command.hasOwnProperty(i))
			{
				command[i] = this[i]
			}
		}
		return command
	}

	copyAllParametersFromCommand(command:AudioCommand):AudioCommand{
		for (let i in this)
		{
			if (command.hasOwnProperty(i))
			{
				this[i] = command[i]
			}
		}
		return command
	}

	/**
	 * Show characteristics about this data 
	 * @returns {string}
	 */
	toString():string {
		let output = `#${this.id} = ${this.time}. ${this.from}:Input::${this.subtype} Type:${this.type}`
		if (this.noteNumber) { output += ` Note:${this.noteNumber}` }
		if (this.velocity) { output += ` Velocity:${this.velocity}` }
		return output + '\n'
	}

	/**
	 * Pass in some string data to load this
	 * AudioCommand fully populated
	 */
	importData(data:string){

	}

	/**
	 * Convert this data to a string
	 */
	exportData():string{
		return `{
		
		}`
	}
}
