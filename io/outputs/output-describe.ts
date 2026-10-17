import type { IAudioOutput } from './output-interface.ts'
import { describeChord, precacheChordDescriptions, type ChordDescription } from '../../tuning/chords/describe-chord.ts'

export default class OutputDescribe extends EventTarget implements IAudioOutput {
    static ID = 0
    #uuid = 'Output-Describe-' + OutputDescribe.ID++
    #activeNotes = new Set<number>()
    #container: HTMLElement | null = null
    #heading: HTMLElement | null = null
    #description: HTMLElement | null = null
    #notes: HTMLElement | null = null
    #chord: ChordDescription | null = null

    constructor() {
        super()
        precacheChordDescriptions()
    }

    get uuid(): string { return this.#uuid }
    get name(): string { return 'Describe' }
    get description(): string { return 'Describes playing notes, chord names, extensions and inversions in musical language' }
    get isConnected(): boolean { return true }
    get isHidden(): boolean { return false }
    get chord(): ChordDescription { return this.#chord ??= describeChord([...this.#activeNotes]) }

    hasMidiOutput(): boolean { return false }
    hasAudioOutput(): boolean { return false }
    hasAutomationOutput(): boolean { return false }
    hasMpeOutput(): boolean { return false }
    hasOscOutput(): boolean { return false }
    hasSysexOutput(): boolean { return false }

    noteOn(noteNumber: number, velocity = 1): void {
        if (velocity <= 0) { this.noteOff(noteNumber); return }
        if (!Number.isInteger(noteNumber) || noteNumber < 0 || noteNumber > 127) return
        if (this.#activeNotes.has(noteNumber)) return
        this.#activeNotes.add(noteNumber)
        this.#chord = null
        this.#render()
    }

    noteOff(noteNumber: number): void {
        if (!this.#activeNotes.delete(noteNumber)) return
        this.#chord = null
        this.#render()
    }

    allNotesOff(): void {
        if (!this.#activeNotes.size) return
        this.#activeNotes.clear()
        this.#chord = null
        this.#render()
    }

    async createGui(): Promise<HTMLElement> {
        if (this.#container) return this.#container
        this.#container = document.createElement('div')
        this.#container.id = this.uuid
        this.#container.className = 'output-describe'
        this.#container.setAttribute('role', 'status')
        this.#container.setAttribute('aria-live', 'polite')
        this.#container.setAttribute('aria-atomic', 'true')
        Object.assign(this.#container.style, {
            padding: '12px', maxWidth: '360px', minWidth: '220px',
            whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: '1.5',
        })
        this.#heading = document.createElement('strong')
        this.#description = document.createElement('p')
        this.#notes = document.createElement('small')
        this.#container.append(this.#heading, this.#description, this.#notes)
        this.#render()
        return this.#container
    }

    async destroyGui(): Promise<void> {
        this.#container?.remove()
        this.#container = null
        this.#heading = null
        this.#description = null
        this.#notes = null
    }

    #render(): void {
        if (!this.#container) return
        const chord = this.chord
        this.#heading!.textContent = chord.name
        this.#description!.textContent = chord.description
        this.#notes!.textContent = chord.notes.length ? `Notes: ${chord.notes.join(', ')}` : ''
    }
}
