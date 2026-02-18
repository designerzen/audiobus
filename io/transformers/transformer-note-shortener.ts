import type { IAudioCommand } from "../../audio-command-interface.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from '../../commands'
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"

export const ID_NOTE_SHORTENER = "Note-Shortener"

interface Config {
    duration: string // Note division: '1/4', '1/8', '1/16', '1/32', or 'triplet'
}

const DEFAULT_OPTIONS: Config = {
    duration: '1/16', // 16th notes
}

/**
 * Note Shortener Transformer
 *
 * Shortens the duration of notes by generating NOTE_OFF commands after a fixed delay.
 * The delay is configurable based on beat speed (e.g., 1/16, 1/8, etc.).
 */
export class TransformerNoteShortener extends Transformer<Config> implements ITransformer{

    protected type = ID_NOTE_SHORTENER
	category = TRANSFORMER_CATEGORY_TIMING

    // Track NOTE_ON commands with their scheduled NOTE_OFF times
    private noteOnMap: Map<number, {startAt: number, originalEndAt?: number}> = new Map()

    get name(): string {
        return 'Note Shortener'
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
                name: 'duration',
                type: 'select',
                values: [
                    { name: '1/32', value: '1/32' },
                    { name: '1/16', value: '1/16' },
                    { name: 'Triplet', value: 'triplet' },
                    { name: '1/8', value: '1/8' },
                    { name: '1/4', value: '1/4' }
                ],
                default: DEFAULT_OPTIONS.duration
            }
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    /**
     * Calculate duration in milliseconds based on note division and BPM
     */
    private calculateDurationMs(duration: string, bpm: number): number {
        // Default to 120 BPM if not available
        const tempo = bpm || 120
        const beatDurationMs = (60 / tempo) * 1000 // Duration of one quarter note in ms

        switch (duration) {
            case '1/4':
                return beatDurationMs
            case '1/8':
                return beatDurationMs / 2
            case '1/16':
                return beatDurationMs / 4
            case '1/32':
                return beatDurationMs / 8
            case 'triplet':
                return beatDurationMs / 3
            default:
                return beatDurationMs / 4 // Default to 16th notes
        }
    }

    transform(commands: IAudioCommand[], timer: Timer ): IAudioCommand[] {
        const bpm = timer?.BPM || 120
        const durationMs = this.calculateDurationMs(this.config.duration, bpm)

        console.log('[NOTE_SHORTENER] Transform called', {
            enabled: this.config.enabled,
            commandCount: commands.length,
            duration: this.config.duration,
            bpm,
            durationMs
        })

        if (!this.config.enabled || commands.length === 0) {
            return commands
        }

        const shortened: IAudioCommand[] = []

        for (const command of commands) {
            if (command.type === Commands.NOTE_ON) {
                // Generate both NOTE_ON and scheduled NOTE_OFF based on duration
                const noteOnTime = command.startAt || command.time

                // Add the original NOTE_ON
                shortened.push(command)

				// Convert duration from milliseconds to seconds and schedule NOTE_OFF
                const durationSeconds = durationMs / 1000
                // Create a NOTE_OFF scheduled after the configured duration (tempo-synced)
                const noteOffCmd = createAudioCommand(  Commands.NOTE_OFF, command.number, noteOnTime + durationSeconds )
                noteOffCmd.velocity = command.velocity || 100
             
                console.log('[NOTE_SHORTENER] Creating scheduled NOTE_OFF', {
                    noteNumber: command.number,
                    noteOnTime,
                    durationMs,
                    durationSeconds,
                    noteOffStartAt: noteOffCmd.startAt,
                    delay: noteOffCmd.startAt - noteOnTime
                })

                shortened.push(noteOffCmd)

                // Track that we've handled this note
                this.noteOnMap.set(command.number, {
                    startAt: noteOnTime
                })

            } else if (command.type === Commands.NOTE_OFF) {
                // Skip the original NOTE_OFF since we already generated one
                // Just clean up the tracking
                this.noteOnMap.delete(command.number)
            } else {
                // Other commands pass through unchanged
                shortened.push(command)
            }
        }

        return shortened
    }

    reset(): void {
        this.noteOnMap.clear()
    }
}




