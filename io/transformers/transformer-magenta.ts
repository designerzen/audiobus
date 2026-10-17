import { Transformer } from './abstract-transformer.ts'
import { TRANSFORMER_CATEGORY_TUNING } from './transformer-categories.ts'
import { NOTE_ON, NOTE_OFF } from '../../commands'
import { cloneAudioCommand } from '../../audio-command-factory.ts'
import { MAGENTA_GENERATE, MAGENTA_RESULT, MAGENTA_STATUS, MAGENTA_ERROR } from './magenta-messages.ts'
import type { MelodyNote, MagentaRequest } from './magenta-messages.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { FieldConfig } from './interface-transformer.ts'
import type { ITimerControl as Timer } from 'netronome'

export const ID_MAGENTA = 'Magenta-Melody'

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const SCALES: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    chromatic: Array.from({ length: 12 }, (_, i) => i),
}
const DEFAULT_OPTIONS = {
    enabled: 1,
    model: 'chord_pitches_improv',
    temperature: 1,
    steps: 32,
    seedNotes: 8,
    root: 0,
    scale: 'major',
    chordProgression: '',
    regenerate: 1,
    playbackRate: 1,
    delayBeats: 0,
    gate: 0.8,
    transpose: 0,
    minPitch: 48,
    maxPitch: 84,
    velocity: 0.7,
    channel: 0,
}
type Config = typeof DEFAULT_OPTIONS

export class TransformerMagenta extends Transformer<Config> {
    protected type = ID_MAGENTA
    category = TRANSFORMER_CATEGORY_TUNING
    status = 'Play notes to generate a melody. The first use downloads model weights.'
    private worker?: Worker
    private requestId = 0
    private busy = false
    private failed = false
    private destroyed = false
    private ready?: MelodyNote[]
    private history: { pitch: number; time: number }[] = []
    private nextPhraseAt = -Infinity

    get name() { return 'Magenta Melody' }
    get description() {
        return 'Google Magenta generates a supplementary melody from your playing. Once ready, the next played note starts the phrase. Blank chord progression uses the selected key; enter chords such as C, Am, F, G to override it. Set channel to 0 to follow the input.'
    }

    get fields(): FieldConfig[] {
        const labels: Partial<Record<keyof Config, string>> = {
            model: 'Magenta model', temperature: 'Temperature (0 = deterministic)',
            steps: 'Phrase length (16th-note steps)', seedNotes: 'Input notes used as seed',
            root: 'Key', scale: 'Output scale', regenerate: 'Generation mode',
            playbackRate: 'Playback speed', delayBeats: 'Delay (beats)', gate: 'Note length ratio',
            transpose: 'Transpose (semitones)', minPitch: 'Lowest MIDI pitch', maxPitch: 'Highest MIDI pitch',
            velocity: 'Velocity ratio', channel: 'Output MIDI channel',
        }
        const select = (name: keyof Config, values: FieldConfig['values']): FieldConfig => ({
            name, label: labels[name], type: 'select', enabled: true, values, default: this.config?.[name] ?? DEFAULT_OPTIONS[name],
        })
        return [
            select('enabled', [{ name: 'On', value: 1 }, { name: 'Off', value: 0 }]),
            select('model', [
                { name: 'Chord-conditioned improvisation', value: 'chord_pitches_improv' },
                { name: 'Melody continuation (scale constrained)', value: 'basic_rnn' },
            ]),
            select('temperature', [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]),
            select('steps', [8, 16, 32, 64, 128]),
            select('seedNotes', [1, 2, 4, 8, 16, 32]),
            select('root', ROOTS.map((name, value) => ({ name, value }))),
            select('scale', Object.keys(SCALES)),
            { name: 'chordProgression', label: 'Chords (e.g. C, Am, F, G; blank = key)', type: 'text', enabled: true, values: [], default: this.config?.chordProgression ?? '' },
            select('regenerate', [{ name: 'New melody each phrase', value: 1 }, { name: 'Repeat generated melody', value: 0 }]),
            select('playbackRate', [0.25, 0.5, 1, 2, 4]),
            select('delayBeats', [0, 0.25, 0.5, 1, 2, 4, 8]),
            select('gate', [0.25, 0.5, 0.75, 0.8, 1]),
            select('transpose', [-24, -12, -7, -5, 0, 5, 7, 12, 24]),
            select('minPitch', [0, 24, 36, 48, 60, 72, 84, 96]),
            select('maxPitch', [36, 48, 60, 72, 84, 96, 108, 127]),
            select('velocity', [0.1, 0.25, 0.5, 0.7, 0.75, 1]),
            select('channel', [{ name: 'Follow input', value: 0 }, ...Array.from({ length: 16 }, (_, i) => i + 1)]),
        ]
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
        // UI select values are strings; normalize persisted configurations too.
        for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof Config)[]) {
            if (typeof DEFAULT_OPTIONS[key] === 'number') this.setConfig(key, this.config[key])
        }
    }

    override setConfig(key: string, value: unknown): void {
        const field = key as keyof Config
        if (typeof DEFAULT_OPTIONS[field] === 'number') {
            const number = Number(value)
            value = Number.isFinite(number) ? number : DEFAULT_OPTIONS[field]
        }
        super.setConfig(key, value)
        // The base constructor also calls setConfig before subclass state exists.
        if (key in DEFAULT_OPTIONS && this.requestId !== undefined) this.reset()
    }

    transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
        if (!this.config.enabled || this.destroyed) return commands
        const notes = commands.filter(c => c.type === NOTE_ON && c.velocity > 0 && c.channel !== 10)
        if (!notes.length) return commands
        for (const note of notes) {
            this.history.push({ pitch: note.number, time: note.startAt ?? timer.now })
        }
        this.history = this.history.sort((a, b) => a.time - b.time).slice(-this.config.seedNotes)
        const trigger = notes[0]
        const now = trigger.startAt ?? timer.now
        let result = commands
        if (this.ready && now >= this.nextPhraseAt) {
            result = [...commands, ...this.schedule(this.ready, trigger, timer.bpm)]
            const secondsPerStep = 60 / timer.bpm / 4 / this.config.playbackRate
            this.nextPhraseAt = now + this.config.delayBeats * 60 / timer.bpm + this.config.steps * secondsPerStep
            if (this.config.regenerate) this.ready = undefined
        }
        if (!this.ready && !this.busy && !this.failed) this.generate(timer.bpm)
        return result
    }

    private generate(bpm: number): void {
        this.busy = true
        try {
            if (!this.worker) {
                this.worker = new Worker(new URL('./magenta.worker.ts', import.meta.url), { type: 'module' })
                this.worker.onmessage = ({ data }) => {
                    if (data.id !== this.requestId) return
                    if (data.kind === MAGENTA_STATUS) this.status = data.status
                    if (data.kind === MAGENTA_RESULT) {
                        this.busy = false
                        this.ready = data.notes
                        this.status = data.notes.length ? 'Melody ready — play a note to start the next phrase.' : 'Generated a rest. Play again to generate another phrase.'
                        if (!data.notes.length) this.ready = undefined
                    }
                    if (data.kind === MAGENTA_ERROR) this.fail(data.error)
                }
                this.worker.onerror = () => this.fail('Unable to start the Magenta worker.')
            }
            const stepSeconds = 60 / bpm / 4
            const origin = this.history[0].time
            const notes: MelodyNote[] = []
            for (const input of this.history) {
                const step = Math.max(0, Math.min(127, Math.round((input.time - origin) / stepSeconds)))
                const previous = notes.at(-1)
                // MusicRNN takes a monophonic primer; use the last note of a chord.
                if (previous && previous.quantizedStartStep === step) notes.pop()
                else if (previous) previous.quantizedEndStep = step
                notes.push({ pitch: input.pitch, quantizedStartStep: step, quantizedEndStep: step + 1 })
            }
            const chords = this.config.chordProgression.trim().split(/[\s,]+/).filter(Boolean)
            const request: MagentaRequest = {
                kind: MAGENTA_GENERATE, id: ++this.requestId, model: this.config.model,
                notes, totalQuantizedSteps: notes.at(-1)!.quantizedEndStep,
                steps: this.config.steps, temperature: this.config.temperature,
                chords: chords.length ? chords : [ROOTS[this.config.root] + (['minor', 'dorian'].includes(this.config.scale) ? 'm' : '')],
            }
            this.status = 'Preparing supplementary melody…'
            this.worker.postMessage(request)
        } catch (error) { this.fail(String(error)) }
    }

    private schedule(notes: MelodyNote[], trigger: IAudioCommand, bpm: number): IAudioCommand[] {
        const stepSeconds = 60 / bpm / 4 / this.config.playbackRate
        const base = trigger.startAt + this.config.delayBeats * 60 / bpm
        const low = Math.min(this.config.minPitch, this.config.maxPitch)
        const high = Math.max(this.config.minPitch, this.config.maxPitch)
        const scale = SCALES[this.config.scale] ?? SCALES.major
        const pitches = Array.from({ length: high - low + 1 }, (_, i) => i + low)
            .filter(p => scale.includes((p - this.config.root + 120) % 12))
        if (!pitches.length) return []
        const output: IAudioCommand[] = []
        for (const note of notes) {
            if (!Number.isFinite(note.pitch) || !(note.quantizedEndStep > note.quantizedStartStep)) continue
            const pitch = note.pitch + this.config.transpose
            const number = pitches.reduce((a, b) => Math.abs(b - pitch) < Math.abs(a - pitch) ? b : a)
            const startAt = base + note.quantizedStartStep * stepSeconds
            const endAt = startAt + (note.quantizedEndStep - note.quantizedStartStep) * stepSeconds * this.config.gate
            const on = cloneAudioCommand(trigger)
            // Native MIDI payloads describe the input note, not the generated note.
            delete on.ump
            delete on.umpOriginal
            on.raw = new Uint8Array()
            Object.assign(on, { type: NOTE_ON, subtype: NOTE_ON, number, value: number, startAt, time: startAt, endAt,
                channel: this.config.channel || trigger.channel,
                velocity: Math.max(1, Math.min(127, Math.round(trigger.velocity * this.config.velocity))) })
            output.push(on, { ...on, type: NOTE_OFF, subtype: NOTE_OFF, startAt: endAt, time: endAt, velocity: 0 })
        }
        return output.sort((a, b) => a.startAt - b.startAt)
    }

    private fail(error: string): void {
        this.busy = false
        this.failed = true
        this.status = `Magenta unavailable: ${error} Change a setting to retry.`
        this.worker?.terminate()
        this.worker = undefined
    }

    reset(): void {
        this.requestId++
        this.worker?.terminate()
        this.worker = undefined
        this.busy = false
        this.failed = false
        this.ready = undefined
        this.history = []
        this.nextPhraseAt = -Infinity
        this.status = 'Play notes to generate a melody. The first use downloads model weights.'
    }

    destroy(): void {
        this.reset()
        this.destroyed = true
    }
}
