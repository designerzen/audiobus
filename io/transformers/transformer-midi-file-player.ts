import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from '../../commands'
import { Midi } from "@tonejs/midi"

import type Timer from "../../timing/timer.ts"
import type { ITransformer, FieldConfig } from "./interface-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_MIDI_FILE_PLAYER = "MIDI-File-Player"

interface Config {
    midiFileUrl: string
    enabled: boolean
    // Whether to align the loaded MIDI file to incoming note timing
    alignToIncoming: boolean
    // Time offset to apply to the MIDI file (in seconds)
    timeOffset: number
}

const DEFAULT_OPTIONS: Config = {
    midiFileUrl: "",
    enabled: true,
    alignToIncoming: true,
    timeOffset: 0
}

/**
 * MIDI File Player Transformer
 *
 * Loads a MIDI file and replaces incoming NOTE_ON/NOTE_OFF commands
 * with the notes from the MIDI file. Plays the MIDI file in place of
 * the provided commands.
 *
 * When a NOTE_ON is received, it triggers playback of the loaded MIDI file.
 * The file's timing is maintained relative to the first incoming command.
 */
export class TransformerMIDIFilePlayer extends Transformer<Config> implements ITransformer {

    protected type = ID_MIDI_FILE_PLAYER
  
    private midiData: any = null
    private midiCommands: IAudioCommand[] = []
    private isLoading = false

    get name(): string {
        return "MIDI File Player"
    }

    get description(): string {
        return "Replace notes with commands from a loaded MIDI file"
    }

	get category():string{
		return TRANSFORMER_CATEGORY_TIMING
	}

    get fields(): FieldConfig[] {
    	return [
    		{
    			name: "enabled",
    			type: "select",
    			enabled: true,
    			values: [
    				{ name: "On", value: 1 },
    				{ name: "Off", value: 0 }
    			],
    			default: 1
    		},
    		{
    			name: "midiFileUrl",
    			type: "text",
    			enabled: true,
    			values: [],
    			default: DEFAULT_OPTIONS.midiFileUrl
    		},
    		{
    			name: "alignToIncoming",
    			type: "select",
    			enabled: true,
    			values: [
    				{ name: "Yes", value: 1 },
    				{ name: "No", value: 0 }
    			],
    			default: 1
    		},
    		{
    			name: "timeOffset",
    			type: "slider",
    			enabled: true,
    			values: [],
    			default: DEFAULT_OPTIONS.timeOffset
    		}
    	]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })

        // Load the MIDI file if URL is provided
        if (this.config.midiFileUrl) {
            this.loadMIDIFile(this.config.midiFileUrl)
        }
    }

    /**
     * Load a MIDI file from the given URL
     */
    async loadMIDIFile(url: string): Promise<void> {
        if (this.isLoading) return

        this.isLoading = true

        try {
            // Fetch the MIDI file from the URL
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch MIDI file: ${response.statusText}`)
            }

            const arrayBuffer = await response.arrayBuffer()

            // Parse MIDI using @tonejs/midi library
            this.midiData = new Midi(arrayBuffer)

            // Extract NOTE_ON and NOTE_OFF commands from the loaded data
            this.extractMIDICommands()

            this.setConfig("midiFileUrl", url)
        } catch (error) {
            console.error(`Failed to load MIDI file from ${url}:`, error)
            this.midiData = null
            this.midiCommands = []
        } finally {
            this.isLoading = false
        }
    }

    /**
     * Extract NOTE_ON and NOTE_OFF commands from the loaded MIDI data
     */
    private extractMIDICommands(): void {
        this.midiCommands = []

        if (!this.midiData || !this.midiData.tracks || this.midiData.tracks.length === 0) {
            return
        }

        // Process all tracks and extract note events
        for (const track of this.midiData.tracks) {
            if (!track.notes || track.notes.length === 0) {
                continue
            }

            for (const note of track.notes) {
                // Create NOTE_ON command
                const noteOn = new AudioCommand()
                noteOn.type = Commands.NOTE_ON
                noteOn.subtype = "Note on"
                noteOn.number = note.midi
                // @tonejs/midi uses 0-1 for velocity, convert to 0-127
                noteOn.velocity = Math.round((note.velocity || 0.5) * 127)
                noteOn.startAt = note.time
                noteOn.time = note.time
                this.midiCommands.push(noteOn)

                // Create NOTE_OFF command
                const noteOff = new AudioCommand()
                noteOff.type = Commands.NOTE_OFF
                noteOff.subtype = "Note off"
                noteOff.number = note.midi
                noteOff.velocity = 0
                noteOff.startAt = note.time + note.duration
                noteOff.time = note.time + note.duration
                this.midiCommands.push(noteOff)
            }
        }

        // Sort commands by start time
        this.midiCommands.sort((a, b) => a.startAt - b.startAt)
    }

    /**
     * Transform incoming commands by replacing NOTE_ON/OFF with MIDI file notes
     */
    transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
        if (!this.config.enabled || this.midiCommands.length === 0 || this.isLoading) {
            return commands
        }

        const transformed: IAudioCommand[] = []
        let midiStartTime = 0
        let hasNoteOn = false

        // First pass: identify where the MIDI file should start
        for (const command of commands) {
            if (command.type === Commands.NOTE_ON) {
                hasNoteOn = true
                midiStartTime = command.startAt || command.time || 0
                break
            }
        }

        // If no NOTE_ON found, just pass through
        if (!hasNoteOn) {
            return commands
        }

        // Add time offset
        midiStartTime += this.config.timeOffset

        // Generate MIDI commands from the loaded file
        for (const midiCmd of this.midiCommands) {
            const newCmd = new AudioCommand()

            // Copy MIDI command properties
            newCmd.type = midiCmd.type
            newCmd.subtype = midiCmd.subtype
            newCmd.number = midiCmd.number
            newCmd.velocity = midiCmd.velocity
            newCmd.value = midiCmd.value
            newCmd.pitchBend = midiCmd.pitchBend
            newCmd.time = midiCmd.time
            newCmd.timeCode = midiCmd.timeCode
            newCmd.text = midiCmd.text

            // Schedule relative to the first incoming NOTE_ON
            newCmd.startAt = midiStartTime + midiCmd.startAt
            newCmd.endAt = midiCmd.endAt

            transformed.push(newCmd)
        }

        // Pass through any non-NOTE_ON/OFF commands from the input
        for (const command of commands) {
            if (command.type !== Commands.NOTE_ON && command.type !== Commands.NOTE_OFF) {
                transformed.push(command)
            }
        }

        // Sort by startAt to maintain proper timing
        transformed.sort((a, b) => {
            const timeA = a.startAt || a.time || 0
            const timeB = b.startAt || b.time || 0
            return timeA - timeB
        })

        return transformed
    }

    /**
     * Reset the transformer state
     */
    reset(): void {
    	// No state to reset
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.midiData = null
        this.midiCommands = []
    }
}




