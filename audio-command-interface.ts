export interface IAudioCommand {
    
    // Handy places to store information about this command
	id:number
	
    type:string
	subtype:string
    number:number

    channel:number

    // velocity / amplitude value
    velocity:number
    startAt:number
    endAt:number

	// pitch value from MIDI is 0 -> 16383
	value:number
	pitchBend:number

	time:number
    timeCode:number

	text:string


	// UNOFFICAl: Uint8Array
	raw:Uint8Array
	// UNOFFICIAL: From Device (uuid)
	from:string
}
