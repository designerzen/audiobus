/**
 * Randomiser Transformer
 *
 * Randomly shifts notes within a specified range.
 * - uncertainty: Probability (0-100) that a note will be randomised
 * - offset: Maximum range in semitones for random shift (both up and down)
 *
 * Tracks active notes to ensure NOTE_OFF commands turn off the correct randomised notes.
 */

import type { IAudioCommand } from "../../audio-command-interface.ts"
import { Transformer } from "./abstract-transformer.ts"
import * as Commands from '../../commands'
import type { ITransformer } from "./interface-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import { cloneAudioCommand } from "../../audio-command-factory.ts"

export const ID_RANDOMISER = "Randomiser"

interface Config {
    random: number // Probability (0-100) that a note will be shifted
    offset: number      // Maximum range in semitones the note can be moved (up or down)
}

const DEFAULT_OPTIONS: Config = {
    random: 50,     // 50% chance by default
    offset: 12           // Up to 1 octave up or down by default
}

export class TransformerRandomiser extends Transformer<Config> implements ITransformer {

    protected type = ID_RANDOMISER

	category = TRANSFORMER_CATEGORY_TUNING

    // Map: original note number -> randomised note number
    private activeNotes: Map<number, number> = new Map()

    get name(): string {
        return 'Randomiser'
    }

    get description():string{
        return "Randomises notes within a specified range."
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
                name: 'random',
                type: 'select',
                values: [
                    { name: '0%', value: 0 },
                    { name: '10%', value: 10 },
                    { name: '20%', value: 20 },
                    { name: '30%', value: 30 },
                    { name: '40%', value: 40 },
                    { name: '50%', value: 50 },
                    { name: '60%', value: 60 },
                    { name: '70%', value: 70 },
                    { name: '80%', value: 80 },
                    { name: '90%', value: 90 },
                    { name: '100%', value: 100 }
                ],
                default: DEFAULT_OPTIONS.random
            },
            {
                name: 'offset',
                type: 'select',
                values: [
                    { name: '0 semitones', value: 0 },
                    { name: '1 semitone', value: 1 },
                    { name: '2 semitones', value: 2 },
                    { name: '3 semitones', value: 3 },
                    { name: '4 semitones', value: 4 },
                    { name: '5 semitones', value: 5 },
                    { name: '6 semitones', value: 6 },
                    { name: '7 semitones', value: 7 },
                    { name: '8 semitones', value: 8 },
                    { name: '9 semitones', value: 9 },
                    { name: '10 semitones', value: 10 },
                    { name: '11 semitones', value: 11 },
                    { name: '12 semitones (1 octave)', value: 12 },
                    { name: '18 semitones', value: 18 },
                    { name: '24 semitones (2 octaves)', value: 24 }
                ],
                default: DEFAULT_OPTIONS.offset
            }
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    transform(commands: IAudioCommand[], timer?: any): IAudioCommand[] {
        if (!this.config.enabled || commands.length === 0)
        {
            return commands
        }

        return commands.map(command => {
            // Handle NOTE_ON commands
            if (command.type === Commands.NOTE_ON) {
                // Check if we should randomise this note based on the random probability
                const shouldRandomise = Math.random() * 100 < this.config.uncertainty

                if (!shouldRandomise) {
                    // Store the original note as is (no randomisation)
                    this.activeNotes.set(command.number, command.number)
                    return command
                }

                // Calculate random shift within the offset range
                // offset of 12 means we can shift anywhere from -12 to +12 semitones
                const shift = Math.floor(Math.random() * (this.config.offset * 2 + 1)) - this.config.offset

                // Apply the shift to the note number
                const newNoteNumber = command.number + shift

                // Ensure the note stays within valid MIDI range (0-127)
                const clampedNoteNumber = Math.max(0, Math.min(127, newNoteNumber))

                // Store the mapping: original note -> randomised note
                this.activeNotes.set(command.number, clampedNoteNumber)

                // If no actual change, return original
                if (clampedNoteNumber === command.number) {
                    return command
                }

                // Create a new command with the randomised note
                const randomisedCommand = cloneAudioCommand( command )
                randomisedCommand.number = clampedNoteNumber

                console.log(`[RANDOMISER] NOTE_ON: Shifted note ${command.number} by ${shift} to ${clampedNoteNumber}`)

                return randomisedCommand
            }

            // Handle NOTE_OFF commands
            if (command.type === Commands.NOTE_OFF) {
                // Look up what note was actually playing for this original note
                const randomisedNote = this.activeNotes.get(command.number)

                if (randomisedNote === undefined) {
                    // No active note found - pass through as is
                    console.log(`[RANDOMISER] NOTE_OFF: No active note found for ${command.number}`)
                    return command
                }

                // Remove from active notes
                this.activeNotes.delete(command.number)

                // If the note wasn't changed, return original
                if (randomisedNote === command.number) {
                    return command
                }

                // Create NOTE_OFF for the randomised note
                const randomisedCommand = cloneAudioCommand( command )
                randomisedCommand.number = randomisedNote

                //console.log(`[RANDOMISER] NOTE_OFF: Turning off randomised note ${randomisedNote} (original: ${command.number})`)

                return randomisedCommand
            }

            // Pass through all other commands unchanged
            return command
        })
    }

    /**
     * Reset randomiser state (useful when stopping playback)
     */
    reset(): void {
        this.activeNotes.clear()
    }
}




