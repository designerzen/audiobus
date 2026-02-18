import type { IAudioCommand } from "../../audio-command-interface.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from '../../commands'
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"

export const ID_NOTE_REPEATER = "Note-Repeater"

interface Config {
    repeats: number // how many times to repeat (1 = no repeat, 2 = one repeat, etc.)
    delay: number // milliseconds between each repeat
    noteDuration: number // milliseconds - how long each repeated note plays
}

const DEFAULT_OPTIONS: Config = {
    repeats: 2,
    delay: 125, // 125ms = 16th notes at 120 BPM
    noteDuration: 100 // Each note plays for 100ms
}

/**
 * Note Repeater Transformer
 *
 * Repeats incoming notes N times with a specified delay between each repetition.
 * Generates NOTE_ON and NOTE_OFF pairs immediately for each repeat.
 * Uses the same delay approach as the arpeggiator.
 */
export class TransformerNoteRepeater extends Transformer<Config> implements ITransformer{

    protected type = ID_NOTE_REPEATER
	category = TRANSFORMER_CATEGORY_TIMING

    // Track which repeated notes were generated for each original note
    // Map: original note number -> Array of {noteNumber, startAt} for each repeated note
    private repeatedNotesMap: Map<number, Array<{noteNumber: number, startAt: number}>> = new Map()

    get name(): string {
        return 'Note Repeater'
    }

    get description():string{
        return "Repeat all notes a specified amount of times"
    }

    get fields() {
        return [
            {
                name: 'enabled',
                type: 'select',
                values: [
                    { name: 'On', value: 1 },
                    { name: 'Off', value: 0 }
                ],
                default: 1
            },
            {
                name: 'repeats',
                type: 'select',
                values: [
                    { name: '2x', value: 2 },
                    { name: '3x', value: 3 },
                    { name: '4x', value: 4 },
                    { name: '8x', value: 8 },
                    { name: '16x', value: 16 }
                ],
                default: DEFAULT_OPTIONS.repeats
            },
            {
                name: 'delay',
                type: 'select',
                values: [
                    { name: '1/32', value: 62.5 },
                    { name: '1/16', value: 125 },
                    { name: 'Triplet', value: 166.67 },
                    { name: '1/8', value: 250 },
                    { name: '1/4', value: 500 }
                ],
                default: DEFAULT_OPTIONS.delay
            },
            {
                name: 'noteDuration',
                type: 'select',
                values: [
                    { name: '50ms', value: 50 },
                    { name: '100ms', value: 100 },
                    { name: '150ms', value: 150 },
                    { name: '200ms', value: 200 },
                    { name: '250ms', value: 250 }
                ],
                default: DEFAULT_OPTIONS.noteDuration
            }
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    transform(commands: IAudioCommand[], timer:Timer ): IAudioCommand[] {

        if (!this.config.enabled || commands.length === 0) {
            return commands
        }

        const repeated: IAudioCommand[] = []

        for (const command of commands) {
            if (command.type === Commands.NOTE_ON) {
                // Generate repeated NOTE_ON/NOTE_OFF pairs immediately
                const noteOnTime = command.startAt || command.time

                for (let i = 0; i < this.config.repeats; i++) {
                    const delayMs = i * this.config.delay
                    const delaySeconds = delayMs / 1000

                    // Create NOTE_ON with delay
                    const noteOnCmd = this.createCommand(command, delayMs, command.time)
                    repeated.push(noteOnCmd)
  
                    // Schedule NOTE_OFF after the note duration
                    const noteDurationSeconds = this.config.noteDuration / 1000
                    const startAt = noteOnTime + delaySeconds + noteDurationSeconds
                 
					// Create corresponding NOTE_OFF with delay + duration
					const noteOffCmd = createAudioCommand( Commands.NOTE_OFF, command.number, startAt )
     				noteOffCmd.velocity = command.velocity || 100
                    noteOffCmd.time = command.time

                    repeated.push(noteOffCmd)
                }

                // Track that we've handled this note
                this.repeatedNotesMap.set(command.number, [])

            } else if (command.type === Commands.NOTE_OFF) {
                // Skip the original NOTE_OFF since we already generated them
                // Just clean up the tracking
                this.repeatedNotesMap.delete(command.number)

            } else {
                // Other commands pass through unchanged
                repeated.push(command)
            }
        }

        return repeated
    }

    /**
     * Create a new audio command with specified delay
     */
    private createCommand(
        original: IAudioCommand,
        delayMs: number,
        baseTime: number
    ): IAudioCommand {
        const command = new AudioCommand()

        // Copy properties from original
        command.type = original.type
        command.subtype = original.subtype
        command.velocity = original.velocity || 100
        command.value = original.value
        command.pitchBend = original.pitchBend
        command.time = original.time
        command.timeCode = original.timeCode
        command.text = original.text
        command.raw = original.raw
        command.number = original.number

        // Apply timing delay (in milliseconds converted to seconds for audio context)
        const delaySeconds = delayMs / 1000
        command.startAt = baseTime + delaySeconds
        command.endAt = original.endAt

        return command
    }

    reset(): void {
        this.repeatedNotesMap.clear()
    }
}




