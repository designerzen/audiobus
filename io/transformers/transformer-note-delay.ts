import type { IAudioCommand } from "../../audio-command-interface.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from '../../commands'
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"

export const ID_NOTE_DELAY = "Note-Delay"

interface Config {
    useTimeDivision: boolean // true = time division, false = milliseconds
    timeDivision: string // Note division: '1/4', '1/8', '1/16', '1/32', or 'triplet'
    delayMs: number // Delay in milliseconds
    accumulate: boolean // When true, each note gets progressively more delay
}

const DEFAULT_OPTIONS: Config = {
    useTimeDivision: true,
    timeDivision: '1/16', // 16th notes
    delayMs: 100, // 100ms
    accumulate: false
}

/**
 * Note Delay Transformer
 *
 * Delays notes by either a time division (synced to tempo) or a fixed millisecond value.
 * - useTimeDivision: Switch between tempo-synced (true) and millisecond-based (false) delay
 * - timeDivision: The note division to use when in tempo-sync mode
 * - delayMs: The delay in milliseconds when in millisecond mode
 * - accumulate: When enabled, each note gets progressively more delay (spread effect)
 */
export class TransformerNoteDelay extends Transformer<Config> implements ITransformer {

    protected type = ID_NOTE_DELAY
	category = TRANSFORMER_CATEGORY_TIMING

    get name(): string {
        return 'Note Delay'
    }

    get description():string{
        return " Delays notes by a time division"
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
                name: 'useTimeDivision',
                type: 'select',
                values: [
                    { name: 'Time Division', value: 1 },
                    { name: 'Milliseconds', value: 0 }
                ],
                default: DEFAULT_OPTIONS.useTimeDivision
            },
            {
                name: 'timeDivision',
                type: 'select',
                values: [
                    { name: '1/32', value: '1/32' },
                    { name: '1/16', value: '1/16' },
                    { name: 'Triplet', value: 'triplet' },
                    { name: '1/8', value: '1/8' },
                    { name: '1/4', value: '1/4' },
                    { name: '1/2', value: '1/2' },
                    { name: '1 bar', value: '1' }
                ],
                default:DEFAULT_OPTIONS.timeDivision
            },
            {
                name: 'delayMs',
                type: 'select',
                values: [
                    { name: '10ms', value: 10 },
                    { name: '25ms', value: 25 },
                    { name: '50ms', value: 50 },
                    { name: '75ms', value: 75 },
                    { name: '100ms', value: 100 },
                    { name: '150ms', value: 150 },
                    { name: '200ms', value: 200 },
                    { name: '250ms', value: 250 },
                    { name: '300ms', value: 300 },
                    { name: '400ms', value: 400 },
                    { name: '500ms', value: 500 },
                    { name: '750ms', value: 750 },
                    { name: '1000ms', value: 1000 }
                ],
                default: DEFAULT_OPTIONS.delayMs
            },
            {
                name: 'accumulate',
                type: 'select',
                values: [
                    { name: 'Accumulate On', value: 1 },
                    { name: 'Accumulate Off', value: 0 }
                ],
                default: DEFAULT_OPTIONS.accumulate
            }
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    /**
     * Override setConfig to properly parse values from UI
     */
    setConfig(key: string, val: unknown): void {
        // Parse numeric values
        if (key === 'delayMs') {
            (this.config as any)[key] = Number(val)
        } else if (key === 'enabled' || key === 'useTimeDivision' || key === 'accumulate') {
            // Convert 0/1 or "0"/"1" to boolean
            (this.config as any)[key] = Boolean(Number(val))
        } else {
            // String values like timeDivision
            (this.config as any)[key] = val
        }
        console.log('[NOTE_DELAY] Config updated:', { key, val, parsed: (this.config as any)[key], fullConfig: this.config })
    }

    /**
     * Calculate delay duration in milliseconds based on note division and BPM
     */
    private calculateTimeDivisionMs(division: string, bpm: number): number {
        // Default to 120 BPM if not available
        const tempo = bpm || 120
        const beatDurationMs = (60 / tempo) * 1000 // Duration of one quarter note in ms

        switch (division) {
            case '1':
                return beatDurationMs * 4 // Whole note (1 bar in 4/4)
            case '1/2':
                return beatDurationMs * 2
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

    /**
     * Get the delay amount in milliseconds based on current config
     */
    private getDelayMs(bpm: number): number {
        if (this.config.useTimeDivision) {
            return this.calculateTimeDivisionMs(this.config.timeDivision, bpm)
        } else {
            return this.config.delayMs
        }
    }

    transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
        
        if (!this.config.enabled || commands.length === 0) {
            return commands
        }

        const bpm = timer?.BPM || 120
        const delayMs = this.getDelayMs(bpm)
        const delaySeconds = delayMs / 1000

        // Convert accumulate to boolean (it might come as 0/1 from UI)
        console.log('ACCUMULATE?', this.config)
        const shouldAccumulate = Boolean(this.config.accumulate)

        console.log('[NOTE_DELAY] Transform called', {
            enabled: this.config.enabled,
            commandCount: commands.length,
            useTimeDivision: this.config.useTimeDivision,
            timeDivision: this.config.timeDivision,
            delayMs: this.config.delayMs,
            accumulate: this.config.accumulate,
            shouldAccumulate,
            bpm,
            calculatedDelayMs: delayMs,
            delaySeconds
        })

        // Track NOTE_ON/NOTE_OFF indices for accumulation
        // Map to track which NOTE_OFF corresponds to which NOTE_ON index
        const noteDelayMap = new Map<number, number>()
        let noteOnIndex = 0

        // Delay all commands by the specified amount
        const delayed: IAudioCommand[] = commands.map((command, i) => {
            const delayedCommand = { ...command }

            // Calculate delay: if accumulate is on, multiply by note index
            let currentDelay = delaySeconds

            if (shouldAccumulate) {
                if (command.type === Commands.NOTE_ON) {
                    currentDelay = delaySeconds * i
                    // Remember which delay index this note number got
                    noteDelayMap.set(command.number, noteOnIndex)
                    noteOnIndex++
                } else if (command.type === Commands.NOTE_OFF) {
                    // Use the same delay index as the corresponding NOTE_ON
                    const correspondingIndex = noteDelayMap.get(command.number)
                    if (correspondingIndex !== undefined) {
                        currentDelay = delaySeconds * correspondingIndex
                    }
                }
            }

            // Add delay to the startAt time
            if (delayedCommand.startAt !== undefined) {
                delayedCommand.startAt += currentDelay
            } else if (delayedCommand.time !== undefined) {
                // If startAt is not set, add it based on time
                delayedCommand.startAt = delayedCommand.time + currentDelay
            } else {
                // Fallback: just add delay to current time
                delayedCommand.startAt = currentDelay
            }

            console.log('[NOTE_DELAY] Delayed command', {
                type: command.type,
                noteNumber: command.number,
                originalStartAt: command.startAt,
                originalTime: command.time,
                newStartAt: delayedCommand.startAt,
                currentDelay,
                shouldAccumulate,
                accumulateIndex: shouldAccumulate ? (command.type === Commands.NOTE_ON ? noteOnIndex - 1 : noteDelayMap.get(command.number)) : 'N/A'
            })

            return delayedCommand
        })

        return delayed
    }
}




