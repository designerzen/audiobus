import type { IAudioCommand } from "./audio-command-interface.ts"
import AudioCommand from "./audio-command.ts"

/**
 * 
 * @param type 
 * @param noteNumber 
 * @param timer 
 * @param fromDevice 
 * @returns Simple Object
 */
export const createAudioCommand = (type:string, noteNumber:number, scheduledTime:number, fromDevice:string="Unknown" ):IAudioCommand => {

    // create an AudioCommand for this noteNumber
    // const audioCommand = new AudioCommand()
    const audioCommand:IAudioCommand = {}
    audioCommand.type = type
    audioCommand.subtype = type
    audioCommand.number = noteNumber
    audioCommand.value = noteNumber
    audioCommand.velocity = 100 // Fixed: was incorrectly set to noteNumber
    audioCommand.time = scheduledTime
    audioCommand.startAt = scheduledTime
    audioCommand.from = fromDevice

    return audioCommand
}


export const cloneAudioCommand = ( command:IAudioCommand ):IAudioCommand => {
	return Object.assign( {}, command )
}
