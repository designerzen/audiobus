
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { cloneAudioCommand, createAudioCommand } from "../../audio-command-factory.ts"
import { Transformer } from "./abstract-transformer.ts"
import * as Commands from '../../commands'

import type { IAudioCommand } from "../../audio-command-interface.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"

export const ID_ARPEGGIATOR = "Arpeggiator"

type ArpPattern = 'up' | 'down' | 'up-down' | 'down-up' | 'random' | 'chord'

interface Config {
    pattern: ArpPattern
    rate: string // Note division: '1/4', '1/8', '1/16', '1/32', or 'triplet'
    octaves: number // how many octaves to span (1-4)
}

const DEFAULT_OPTIONS: Config = {
    pattern: 'up',
    rate: '1/16', // 16th notes
    octaves: 1
}

/**
 * Fisher-Yates shuffle for randomising array entries
 */
const shuffleArray = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

/**
 * Arpeggiator Transformer
 *
 * Takes incoming note commands and generates arpeggiated patterns.
 * When multiple notes are held down, creates an arpeggio sequence.
 *
 * Patterns:
 * - up: Notes ascending
 * - down: Notes descending
 * - up-down: Ascend then descend
 * - down-up: Descend then ascend
 * - random: Random order
 * - chord: All notes at once (passthrough)
 */
export class TransformerArpeggiator extends Transformer<Config> implements ITransformer {

    protected type = ID_ARPEGGIATOR

	category = TRANSFORMER_CATEGORY_TIMING

    // Track currently held notes to build the arpeggio sequence
    private heldNotes: Set<number> = new Set()

    // Track when notes were pressed to handle timing
    private noteOnTimes: Map<number, number> = new Map()

    // Track which arpeggiated notes were generated for each original note
    // Map: original note number -> Array of {noteNumber, startAt} for each arpeggiated note
    private arpeggiatedNotesMap: Map<number, Array<{noteNumber: number, startAt: number}>> = new Map()

    get name(): string {
        return 'Arpeggiator'
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
                name: 'pattern',
                type: 'select',
                values: [
                    { name: 'Up', value: 'up' },
                    { name: 'Down', value: 'down' },
                    { name: 'Up-Down', value: 'up-down' },
                    { name: 'Down-Up', value: 'down-up' },
                    { name: 'Random', value: 'random' },
                    { name: 'Chord', value: 'chord' }
                ],
                default: DEFAULT_OPTIONS.pattern
            },
            {
                name: 'rate',
                type: 'select',
                values: [
                    { name: '1/4', value: '1/4' },
                    { name: '1/8', value: '1/8' },
                    { name: '1/16', value: '1/16' },
                    { name: '1/32', value: '1/32' },
                    { name: 'Triplet', value: 'triplet' }
                ],
                default: DEFAULT_OPTIONS.rate
            },
            {
                name: 'octaves',
                type: 'select',
                values: [1, 2, 3, 4],
                default: DEFAULT_OPTIONS.octaves
            }
        ]
    }

    get description():string{
        return "Arpeggiate incoming notes based on the selected pattern and rate."
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    /**
     * Calculate delay in milliseconds based on note division and BPM
     */
    private calculateDelayMs(rate: string, bpm: number): number {
        const beatDurationMs = (60 / bpm) * 1000 // Duration of one quarter note in ms
        switch (rate) {
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
	 * 
	 * @param commands 
	 * @param timer 
	 * @returns 
	 */
    transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {

        if (!this.config.enabled || commands.length === 0) {
            return commands
        }
      
        const bpm = timer.bpm

        // console.log('[ARPEGGIATOR] Transform called', {
        //     enabled: this.config.enabled,
        //     commandCount: commands.length,
        //     config: this.config,
        //     bpm
        // })

        const arpeggiated: IAudioCommand[] = []

        // Group note-on commands that occur at the same time (chord detection)
        const noteOnCommands: IAudioCommand[] = []
        const otherCommands: IAudioCommand[] = []

        for (const command of commands) {
            if (command.type === Commands.NOTE_ON) {
                noteOnCommands.push(command)
                this.heldNotes.add(command.number)
                this.noteOnTimes.set(command.number, command.startAt || 0)
            } else if (command.type === Commands.NOTE_OFF) {
                // Generate NOTE_OFF for all arpeggiated notes from this original note
                const arpeggiatedNotes = this.arpeggiatedNotesMap.get(command.number)

                // console.log('[ARPEGGIATOR] NOTE_OFF received', {
                //     originalNote: command.number,
                //     arpeggiatedNotes: arpeggiatedNotes ? arpeggiatedNotes.map(n => n.noteNumber) : []
                // })

                if (arpeggiatedNotes) {
                    // Create NOTE_OFF for each unique arpeggiated note
                    // Use a Set to avoid duplicate NOTE_OFFs for the same note number
                    const uniqueNoteNumbers = new Set<number>()
                    const currentTime = command.startAt ?? 0

                    // Find the latest startAt time among arpeggiated notes to schedule NOTE_OFF after them
                    const lastArpeggioTime = arpeggiatedNotes.length > 0 
                        ? Math.max(...arpeggiatedNotes.map(n => n.startAt))
                        : currentTime

                    arpeggiatedNotes.forEach(({noteNumber, startAt}) => {
                        // Only send NOTE_OFF once per unique note number
                        if (!uniqueNoteNumbers.has(noteNumber)) {
                            uniqueNoteNumbers.add(noteNumber)

                            // Schedule NOTE_OFF after the last arpeggiated note starts
                            // This ensures arpeggiated notes play before being released
                            const noteOffCmd = cloneAudioCommand(command)
                            noteOffCmd.type = Commands.NOTE_OFF
                            noteOffCmd.number = noteNumber
                            noteOffCmd.startAt = lastArpeggioTime ?? currentTime
                            noteOffCmd.velocity = command.velocity ?? 100
                           	
                            // console.log('[ARPEGGIATOR] Generating NOTE_OFF', {
                            //     noteNumber,
                            //     velocity: noteOffCmd.velocity,
                            //     noteOnStartAt: startAt,
                            //     currentTime,
                            //     lastArpeggioTime,
                            //     noteOffStartAt: noteOffCmd.startAt
                            // })

                            arpeggiated.push(noteOffCmd)
                        }
                    })

                    // Clear the mapping
                    this.arpeggiatedNotesMap.delete(command.number)
                }

                this.heldNotes.delete(command.number)
                this.noteOnTimes.delete(command.number)
            } else {
                otherCommands.push(command)
            }
        }

        // console.log('[ARPEGGIATOR] Detected commands', {
        //     noteOnCount: noteOnCommands.length,
        //     heldNotes: Array.from(this.heldNotes),
        //     pattern: this.config.pattern
        // })

        // If we have multiple note-on commands at the same time, treat as chord
        if (noteOnCommands.length > 1) {
            // console.log('[ARPEGGIATOR] CHORD DETECTED - generating arpeggio', {
            //     chordSize: noteOnCommands.length,
            //     notes: noteOnCommands.map(c => c.number)
            // })

            // Use the first command as the template for timing
            const templateCommand = noteOnCommands[0]
            const arpeggio = this.generateArpeggio(templateCommand, bpm)

            // console.log('[ARPEGGIATOR] Generated arpeggio', {
            //     inputNotes: noteOnCommands.length,
            //     outputCommands: arpeggio.length,
            //     bpm
            // })

            // Track which arpeggiated notes came from which original notes
            const arpeggiatedNotesData = arpeggio.map(cmd => ({
                noteNumber: cmd.number,
                startAt: cmd.startAt
            }))

            const chordMembers = noteOnCommands.map(c => c.number)
            this.updateArpeggiatedNotesMappings(arpeggiatedNotesData, chordMembers)

            // console.log('[ARPEGGIATOR] Tracking arpeggiated notes', {
            //     originalNotes: chordMembers,
            //     primaryNote: noteOnCommands[0].number,
            //     arpeggiatedNotes: arpeggiatedNotesData.map(n => `${n.noteNumber}@${n.startAt.toFixed(3)}s`)
            // })

            arpeggiated.push(...arpeggio)

        } else if (noteOnCommands.length === 1) {

            // Single note - check if there are already held notes to arpeggiate
            if (this.heldNotes.size > 1) {
                console.log('[ARPEGGIATOR] Single note added to existing chord - generating arpeggio', {
                    totalHeldNotes: this.heldNotes.size,
                    bpm
                })
                const arpeggio = this.generateArpeggio(noteOnCommands[0], bpm)

                const arpeggiatedNotesData = arpeggio.map(cmd => ({
                    noteNumber: cmd.number,
                    startAt: cmd.startAt
                }))

                const heldNotesList = Array.from(this.heldNotes).sort((a, b) => a - b)
                this.updateArpeggiatedNotesMappings(arpeggiatedNotesData, heldNotesList)

                arpeggiated.push(...arpeggio)
            } else {
                 // console.log('[ARPEGGIATOR] Single note - pass through')
                 // Track that this note maps to itself with its original timing
                 this.arpeggiatedNotesMap.set(noteOnCommands[0].number, [{
                     noteNumber: noteOnCommands[0].number,
                     startAt: noteOnCommands[0].startAt ?? 0
                 }])
                 arpeggiated.push(noteOnCommands[0])
            }
        }

        // Add other commands (note-offs, etc.)
        arpeggiated.push(...otherCommands)

        // console.log('[ARPEGGIATOR] Transform complete', {
        //     inputCount: commands.length,
        //     outputCount: arpeggiated.length,
        //     output: arpeggiated
        // })

        // Sort by startAt time to ensure NOTE_OFFs are never scheduled before their NOTE_ONs
        //arpeggiated.sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

        return arpeggiated
    }

    /**
     * Generate arpeggiated note sequence from held notes
     */
    private generateArpeggio(originalCommand: IAudioCommand, bpm: number): IAudioCommand[] {
        const baseNotes = Array.from(this.heldNotes).sort((a, b) => a - b)

        if (baseNotes.length === 0) {
            return [originalCommand]
        }

        // Chord mode: play all notes simultaneously
        if (this.config.pattern === 'chord') {
            return baseNotes.map(noteNumber => this.createCommand(originalCommand, noteNumber, 0, originalCommand.startAt || 0))
        }

        // Build full note sequence including octaves
        const fullSequence = this.buildNoteSequence(baseNotes)

        // Apply pattern to the sequence
        const patternedSequence = this.applyPattern(fullSequence)

        // Create delayed commands for each note in the sequence
        // Use the current time from the command as the base time
        const baseTime = originalCommand.startAt || 0
        const delayMs = this.calculateDelayMs(this.config.rate, bpm)
        return patternedSequence.map( (noteNumber, index) => this.createCommand(originalCommand, noteNumber, index * delayMs, baseTime) )
    }

    /**
     * Build note sequence including octave spans
     */
    private buildNoteSequence(baseNotes: number[]): number[] {
        if (this.config.octaves === 1) {
            return baseNotes
        }

        const extended: number[] = []
        for (let octave = 0; octave < this.config.octaves; octave++) {
            const octaveOffset = octave * 12
            for (const note of baseNotes) {
                const transposed = note + octaveOffset
                // Keep within MIDI range (0-127)
                if (transposed <= 127) {
                    extended.push(transposed)
                }
            }
        }

        return extended
    }

    /**
     * Apply arpeggio pattern to note sequence
     */
    private applyPattern(notes: number[]): number[] {
        switch (this.config.pattern) {
            case 'down':
                return [...notes].reverse()

            case 'up-down':
                const downPart = [...notes].reverse().slice(1)
                return [...notes, ...downPart]

            case 'down-up':
                const upPart = [...notes].slice(1)
                return [...[...notes].reverse(), ...upPart]

            case 'random':
                return shuffleArray([...notes])

            case 'up':
            default:
                return notes
        }
    }

    /**
     * Update arpeggiatedNotesMap for all held notes to ensure proper NOTE_OFF generation
     */
    private updateArpeggiatedNotesMappings(arpeggiatedNotesData: Array<{noteNumber: number, startAt: number}>, heldNotesList: number[]): void {
        // Primary note (first) gets the full arpeggio mapping
        this.arpeggiatedNotesMap.set(heldNotesList[0], arpeggiatedNotesData)
        
        // Other notes get empty arrays to prevent duplicate NOTE_OFFs
        for (let i = 1; i < heldNotesList.length; i++) {
            this.arpeggiatedNotesMap.set(heldNotesList[i], [])
        }
    }


    /**
     * Create a new audio command with specified note and delay
     */
    private createCommand(
        original: IAudioCommand,
        noteNumber: number,
        delayMs: number,
        baseTime: number
    ): IAudioCommand {

        const command:IAudioCommand = cloneAudioCommand(original )

        // Set the arpeggiated note number
        command.number = noteNumber

        // Apply timing delay (in milliseconds converted to seconds for audio context)
        // Use baseTime (current audio context time) as the reference point
        const delaySeconds = delayMs * 0.001
        command.startAt = baseTime + delaySeconds
        command.endAt = original.endAt
        return command
    }

    /**
     * Reset arpeggiator state (useful when stopping playback)
     */
    reset(): void {
        this.heldNotes.clear()
        this.noteOnTimes.clear()
        this.arpeggiatedNotesMap.clear()
    }
}




