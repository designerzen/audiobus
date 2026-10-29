import { PerformanceTransformer, beatSeconds, copyCommand, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'

export const ID_PHRASE_RECOMBINER = 'Phrase-Recombiner'
interface CapturedNote { command: IAudioCommand; offset: number; duration: number }
export class TransformerPhraseRecombiner extends PerformanceTransformer {
    protected type = ID_PHRASE_RECOMBINER
    category = 'Variation'
    private captureStart?: number
    private duration = 0
    private recording = false
    private notes: CapturedNote[] = []
    private recordingVoices = new Map<Voice, CapturedNote>()
    private playback?: Voice
    private played = new Set<Voice>()
    get name() { return 'Phrase Recombiner' }
    get description() { return 'Capture a phrase, then replay rotated, mirrored or shuffled note properties.' }
    get instructions() { return 'Play a phrase during Capture length. It plays through, then a variation repeats. Play another note to start a fresh capture; disable to stop.' }
    get status() { return this.recording ? 'Recording phrase…' : this.playback ? 'Playing variation. Play to record again.' : 'Play to capture a phrase.' }
    constructor(config: Settings = {}) {
        super({ beats: 4, operation: 'rotate', dimension: 'pitch', rotation: 1, loop: 1, level: 85 }, [
            { name: 'beats', label: 'Capture length (beats)', values: [1, 2, 4, 8, 16], min: 1, max: 16 },
            { name: 'operation', label: 'Variation', values: ['rotate', 'mirror', 'shuffle'] },
            { name: 'dimension', label: 'Change only', values: ['pitch', 'velocity', 'rhythm', 'duration'] },
            { name: 'rotation', label: 'Rotate by notes', values: [-8, -4, -2, -1, 1, 2, 4, 8], min: -128, max: 128 },
            { name: 'loop', label: 'Repeat variation', values: [0, 1], min: 0, max: 1 },
            { name: 'level', label: 'Replay velocity (%)', values: [25, 50, 75, 85, 100], min: 1, max: 100 },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const result: IAudioCommand[] = []
        if (!this.recording) {
            if (this.playback) result.push(...this.release(this.playback))
            for (const played of this.played) result.push(...this.release(played))
            this.played.clear()
            this.playback = undefined
            this.notes = []
            this.recordingVoices.clear()
            this.captureStart = this.now
            this.duration = beatSeconds(this.timer) * Number(this.options.beats)
            this.recording = true
            this.schedule(this.now + this.duration, () => this.finishCapture())
        }
        if (this.notes.length < 128) {
            const note = { command: copyCommand(voice.input), offset: this.now - this.captureStart!, duration: this.duration - (this.now - this.captureStart!) }
            this.notes.push(note)
            this.recordingVoices.set(voice, note)
        }
        result.push(this.start(voice))
        return result
    }
    protected noteOff(voice: Voice) {
        const note = this.recordingVoices.get(voice)
        if (note) note.duration = Math.max(0.01, Math.min(note.duration, this.now - this.captureStart! - note.offset))
        this.recordingVoices.delete(voice)
        return this.release(voice)
    }
    private finishCapture() {
        this.recording = false
        this.recordingVoices.clear()
        if (!this.notes.length) return []
        let order = this.notes.map((_, index) => index)
        if (this.options.operation === 'mirror') order.reverse()
        else if (this.options.operation === 'shuffle') {
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[order[i], order[j]] = [order[j], order[i]]
            }
        } else {
            const rotation = Math.round(Number(this.options.rotation))
            order = order.map(index => ((index + rotation) % order.length + order.length) % order.length)
        }
        const notes = this.notes.map((note, i) => {
            const other = this.notes[order[i]]
            return { ...note, command: copyCommand(note.command, {
                number: this.options.dimension === 'pitch' ? other.command.number : note.command.number,
                velocity: this.options.dimension === 'velocity' ? other.command.velocity : note.command.velocity,
            }), offset: this.options.dimension === 'rhythm' ? other.offset : note.offset,
            duration: this.options.dimension === 'duration' ? other.duration : note.duration }
        })
        const playback: Voice = { input: this.notes[0].command, targets: [], released: false }
        this.playback = playback
        this.voices.add(playback)
        return this.replay(notes, playback)
    }
    private replay(notes: CapturedNote[], playback: Voice): IAudioCommand[] {
        if (this.playback !== playback || !this.options.enabled) return []
        const start = this.now
        for (const note of notes) {
            this.schedule(start + note.offset, () => {
                const voice: Voice = { input: note.command, targets: [], released: true }
                this.voices.add(voice)
                this.played.add(voice)
                const on = this.start(voice, note.command.number, this.now, note.command.velocity * Number(this.options.level) / 100)
                const length = Math.max(0.005, Math.min(note.duration, this.duration - note.offset - 0.001))
                this.schedule(this.now + length, () => { this.played.delete(voice); return this.release(voice) }, voice)
                return [on]
            }, playback)
        }
        if (this.options.loop) this.schedule(start + this.duration, () => this.replay(notes, playback), playback)
        return []
    }
    protected clearState() {
        this.recording = false
        this.captureStart = undefined
        this.notes = []
        this.recordingVoices?.clear()
        this.playback = undefined
        this.played?.clear()
    }
}
