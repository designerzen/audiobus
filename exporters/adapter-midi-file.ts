
import { Midi } from '@tonejs/midi'
import type RecorderAudioEvent from '../audio-event-recorder'
import type AudioEvent from '../audio-event'
import type Timer from '../timing/timer'
import { NOTE_OFF, NOTE_ON } from '../commands'

export const saveBlobToLocalFileSystem = (blob:Blob, fileName:string ) => {
     
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.midi` // Specify the file name

    // Trigger the download
    document.body.appendChild(a)
    a.click()

    // Clean up
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * 
 * @param recording 
 * @param timer 
 */
export const createMIDIFileFromAudioEventRecording = async (recording:RecorderAudioEvent, timer:Timer ):Promise<Blob> => {
    const BPM = timer.BPM
    const data:AudioEvent[] = recording.exportData()
    const duration:number = recording.duration   

    const midi = new Midi()
    const track = midi.addTrack()

    midi.header.name = recording.name
    midi.header.setTempo( BPM )

    data.forEach(command => {
        switch( command.type )
        {
            case NOTE_ON :
                track.addNote({
                    midi :  command.noteNumber,
                    time :  command.startAt,
                    duration: command.duration
                })
                break
        }
    })
    
    return new Blob( [midi.toArray()], { type: 'application/octet-stream' })
}


