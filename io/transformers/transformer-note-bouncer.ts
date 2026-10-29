import { PerformanceTransformer, beatSeconds, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'

export const ID_NOTE_BOUNCER = 'Note-Bouncer'
export class TransformerNoteBouncer extends PerformanceTransformer {
    protected type = ID_NOTE_BOUNCER
    category = 'Pattern'
    get name() { return 'Note Bouncer' }
    get description() { return 'Create a finite series of progressively faster, softer note bounces.' }
    constructor(config: Settings = {}) {
        super({ beats: 1, damping: 70, decay: 80, count: 8, minimum: 25, gate: 40, cancelOnRelease: 1 }, [
            { name: 'beats', label: 'First bounce (beats)', values: [0.125, 0.25, 0.5, 1, 2, 4], min: 0.125, max: 4 },
            { name: 'damping', label: 'Next interval (%)', values: [40, 50, 60, 70, 80, 90, 100], min: 10, max: 100,
                help: '70% makes each bounce interval 30% shorter than the preceding one.' },
            { name: 'decay', label: 'Velocity retained per bounce (%)', values: [40, 50, 60, 70, 80, 90, 100], min: 10, max: 100 },
            { name: 'count', label: 'Maximum attacks', values: [2, 3, 4, 6, 8, 12, 16], min: 1, max: 32 },
            { name: 'minimum', label: 'Shortest interval (ms)', values: [10, 20, 25, 40, 60, 100], min: 10, max: 250 },
            { name: 'gate', label: 'Note length (% of interval)', values: [10, 25, 40, 50, 75, 90], min: 1, max: 95 },
            { name: 'cancelOnRelease', label: 'Stop when key is released', values: [0, 1], min: 0, max: 1 },
        ], config)
    }
    protected noteOn(voice: Voice) { return this.bounce(voice, 0, beatSeconds(this.timer) * Number(this.options.beats)) }
    private bounce(voice: Voice, index: number, interval: number): IAudioCommand[] {
        const velocity = Math.round(voice.input.velocity * (Number(this.options.decay) / 100) ** index)
        if (velocity < 1 || (index > 0 && interval * 1000 < Number(this.options.minimum))) return this.release(voice)
        const on = this.start(voice, voice.input.number, this.now, velocity)
        const last = index + 1 >= Math.round(Number(this.options.count)) || interval * Number(this.options.damping) / 100 * 1000 < Number(this.options.minimum)
        this.schedule(this.now + interval * Number(this.options.gate) / 100, () => last ? this.release(voice) : [this.end(voice, on)], voice)
        if (!last) this.schedule(this.now + interval, () => this.bounce(voice, index + 1, interval * Number(this.options.damping) / 100), voice)
        return [on]
    }
    protected noteOff(voice: Voice) { return this.options.cancelOnRelease ? this.release(voice) : [] }
}
