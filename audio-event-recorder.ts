/**
 * Record any sequence of audio commands
 */

import { NOTE_OFF, NOTE_ON } from './commands'
import AudioEvent from "./audio-event.ts"
import AudioCommand from "./audio-command.ts"
import { createAudioCommand } from "./audio-command-factory.ts"

import type OPFSStorage from "./storage/opfs-storage.ts"
import type { IAudioCommand } from "./audio-command-interface.ts"

interface SessionMetadata {
  name: string
  duration: number
  createdAt: number
  updatedAt: number
}

// Append a small duration to the end of the duration
const GAP = 0.5
    
export default class AudioEventRecorder extends EventTarget{

    #events:IAudioCommand[] = []

    #enabled:boolean = true
    #duration:number = 0
    #name:string = "Recording"

    #storage:OPFSStorage | null = null
        
    get name():string{
        return this.#name
    }

    get duration():number{
        return this.#duration + GAP
    }

    get enabled():boolean{
        return this.#enabled
    }

	get quantity():number{
		return this.#events.length
	}
	
	get events():IAudioCommand[]{
		return this.#events
	}

    set enabled(value:boolean){
        this.#enabled = value
    }

    constructor(name:string = "Harmoneasy"){
        super()
        this.#name = name
    }

    setStorage(storage:OPFSStorage){
        this.#storage = storage
    }

    addEvents( events:AudioEvent[] ):IAudioCommand[]{
        if (this.#enabled)
        {
            events.forEach( event => this.addEvent(event))
        }
        return this.#events
    }

    addEvent( event:AudioEvent ):IAudioCommand{
        if (!this.#enabled)
        {
            return event
        }

        this.#events.push(event)

        if (this.#storage) {
            this.saveEventToStorage(event)
            // Update metadata on each event
            this.updateMetadata()
        }

        if (this.#duration < event.startAt ) {
            this.#duration = event.startAt
        }
        return event
    }

    /**
     * Save AudioEvent to OPFS storage in real-time
     */
    private async saveEventToStorage(event:AudioEvent): Promise<void> {
        if (!this.#storage) return
        
        try {
            // Convert AudioEvent to AudioCommand for storage
            const command = event as unknown as AudioCommand
            await this.#storage.addEvent(command)
        } catch (error) {
            console.error('Error saving event to storage:', error)
        }
    }

    /**
     * Update and save session metadata
     */
    private async updateMetadata(): Promise<void> {
        if (!this.#storage)
        {
            console.warn('Storage not initialized')
            return
        } 
        
        try {
            const metadata: SessionMetadata = {
                name: this.#name,
                duration: this.duration,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
            await this.#storage.saveMetadata(metadata)
        } catch (error) {
            console.error('Error updating metadata:', error)
        }
    }

    /**
     * Clear all events and storage
     * and reset the recording
     */
    clear(){
        this.#events.length = 0
        if (this.#storage)
        {
            this.#storage.clear()
        }
    }

    /**
     * Load all saved data from OPFS storage and add to existing memory
     * Chunks data to prevent UI blocking on large datasets
     */
    async loadDataFromStorage( onProgress=()=>{}, log:bolean=true ): Promise<void> {
        if (!this.#storage) {
            console.warn('Storage not initialized')
            return
        }

        try {
            // Load metadata first
            const metadata = await this.#storage.readMetadata()
            if (metadata) {
                const m = metadata as SessionMetadata
                if (log)
                {
                    console.info(`📊 OPFS Session: "${m.name}"`)
                    console.info(`   Duration: ${m.duration.toFixed(2)}s`)
                    console.info(`   Last updated: ${new Date(m.updatedAt).toLocaleString()}`)     
                }
            }

            const commands = await this.#storage.readAll()
            
            if (commands.length === 0) {
                if (log)
                {
                    console.info('✅ No previous commands found in storage')           
                }
                return
            }

            if (log)
            {
                console.info(`🔄 Loading ${commands.length} commands from OPFS storage...`)
            }

            // Chunk the data to prevent blocking
            const CHUNK_SIZE = 1024 // arbitrary number
            let processedCount = 0

            for (let i = 0, l=commands.length; i < l; i += CHUNK_SIZE) {
                const chunk = commands.slice(i, i + CHUNK_SIZE)
                
                // Add commands to in-memory events
                chunk.forEach((command, index) => {

					const audioCommand:IAudioCommand = createAudioCommand( command.type, command.number, command.startAt, command.from ?? "Storage" )

                    const event = new AudioEvent( audioCommand, audioCommand.startAt )
                    this.#events.push(event)
                    processedCount++

					// extend known duration
                    if (command.startAt > this.#duration) {
                        this.#duration = audioCommand.startAt
                    }
					onProgress( i/l + (index/CHUNK_SIZE)*0.1 )
                })

                // Yield to main thread periodically
                if (i + CHUNK_SIZE < commands.length) {
                    await new Promise(resolve => setTimeout(resolve, 0))
                }
            }

            console.info(`✨ Successfully loaded ${processedCount} commands`)
        } catch (error) {
            console.error('Error loading data from storage:', error)
        }
    }

   
    /**
     * Sures up each AudioEvent with a finish time
     * sp that the duration for each command is saved within 
     * the event itself
     * 
     * @returns Array of AudioEvents
     */
    exportData():IAudioCommand[]{

        const allEvents = this.#events.slice()
        const quantity = allEvents.length -1
        const currentlyPlaying = new Map()

        // Reverse Loop through array 
        for (let i=quantity; i >= 0 ; --i)
        {
            // find all note off events and find their assoc
            const event = allEvents[i]
            // console.info( "Event", event, {allEvents} )
            switch( event.type )
            {
                case NOTE_ON :

                    const hasNoteOn = currentlyPlaying.has( event.number )
                    if (hasNoteOn)
                    {
                        const noteOffCommand:IAudioCommand = currentlyPlaying.get( event.number )
                        const duration:number = noteOffCommand.startAt - event.startAt

                        // set the end at to the start at time of the note off
                        event.endAt = noteOffCommand.startAt

                        // and update the note offs
                        // noteOffCommand.startAt = event.startAt
                        // noteOffCommand.time = event.startAt
                        noteOffCommand.endAt = noteOffCommand.startAt

                        if (isNaN(duration))
                        {
                            console.info("BAD DURATION NOTE ON Reorganised data", event, duration, { playing: currentlyPlaying })
                        }else{
                            // console.info("FOUND NOTE ON Reorganised data", event,event.duration, duration, { playing: currentlyPlaying })
                        }

                    }else{
                        // console.info("ORPHAN NOTE ON Reorganised data", event, {playing: currentlyPlaying })
                    }

                    currentlyPlaying.delete( event.number )
                    break

                case NOTE_OFF :
                    currentlyPlaying.set( event.number, event )
                    // console.info("NOTE OFF Reorganised data", event, {playing: currentlyPlaying } )
                    break
            }
        }

        // console.info("Note events", allEvents)
        return allEvents
    }
}

