import AbstractInput from './abstract-input'
import AudioCommand from '../../audio-command'
import type { IAudioCommand } from '../../audio-command-interface'

/** A saved tune, armed at the first transport tick and rewound when stopped. */
export default class InputMIDIFile extends AbstractInput {
    #commands: IAudioCommand[]
    #cursor = 0
    #startedAt: number | undefined
    #playing = false
    get name() { return this.options.fileName || 'MIDI File' }
    get description() { return 'Loaded MIDI tune; use transport Play to start and Stop to rewind' }
    hasMidiInput() { return true }

    constructor(options: Record<string, any> = {}) {
        super(options)
        this.#commands = (options.commands ?? []).map((data: Partial<IAudioCommand>) => {
            if (!Number.isFinite(data.startAt) || data.startAt! < 0) throw new Error('Invalid MIDI event time')
            return Object.assign(new AudioCommand(), data)
        }).sort((a: IAudioCommand, b: IAudioCommand) => a.startAt - b.startAt)
        this.setAsConnected()
    }

    updateTime(now: number): void {
        if (!this.isConnected || !this.#playing) return
        this.#startedAt ??= now
        while (this.#cursor < this.#commands.length) {
            const source = this.#commands[this.#cursor]
            if (this.#startedAt + source.startAt > now) break
            const command = Object.assign(new AudioCommand(), source)
            command.startAt = this.#startedAt + source.startAt
            this.#cursor++
            this.dispatch(command)
        }
    }

    startClock(): void { this.#cursor = 0; this.#startedAt = undefined; this.#playing = true }
    stopClock(): void { this.#cursor = 0; this.#startedAt = undefined; this.#playing = false }
    async connect(): Promise<void> { this.setAsConnected() }
    async disconnect(): Promise<void> { this.stopClock(); this.setAsDisconnected() }
    async createGui(): Promise<HTMLElement> {
        const info = document.createElement('p')
        info.textContent = this.#commands.length
            ? `${this.name}: ${this.#commands.length / 2} notes loaded. Use transport Stop, then Play to start the tune.`
            : 'Drop a MIDI file onto the page to create an input with a tune loaded.'
        return info
    }
    destroy(): void { this.stopClock(); this.setAsDisconnected() }
}
