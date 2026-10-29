import { PerformanceTransformer, beatSeconds, numbers, type Settings, type Voice } from './performance-transformer.ts'

export const ID_EUCLIDEAN_GATE = 'Euclidean-Gate'
export function euclideanStep(step: number, steps: number, pulses: number, rotation = 0) {
    const index = ((step - rotation) % steps + steps) % steps
    return (index * pulses) % steps < pulses
}
export class TransformerEuclideanGate extends PerformanceTransformer {
    protected type = ID_EUCLIDEAN_GATE
    category = 'Pattern'
    get name() { return 'Euclidean Gate' }
    get description() { return 'Pulse held notes with evenly distributed rhythms and optional accents.' }
    constructor(config: Settings = {}) {
        super({ steps: 8, pulses: 3, rotation: 0, rate: 0.25, gate: 60, accents: 1, soft: 70 }, [
            { name: 'steps', label: 'Pattern steps', values: numbers(1, 32), min: 1, max: 32 },
            { name: 'pulses', label: 'Pulses', values: numbers(0, 32), min: 0, max: 32 },
            { name: 'rotation', label: 'Rotation', values: numbers(0, 31), min: 0, max: 31 },
            { name: 'rate', label: 'Step length (beats)', values: [0.125, 0.25, 0.5, 1, 2], min: 0.125, max: 2 },
            { name: 'gate', label: 'Note length (%)', values: [10, 25, 50, 60, 75, 90], min: 1, max: 95 },
            { name: 'accents', label: 'Accented pulses', values: numbers(0, 16), min: 0, max: 32 },
            { name: 'soft', label: 'Unaccented velocity (%)', values: [25, 50, 70, 85, 100], min: 1, max: 100 },
        ], config)
    }
    protected noteOn(voice: Voice) { return this.pulse(voice, 0, 0) }
    private pulse(voice: Voice, step: number, count: number): ReturnType<PerformanceTransformer['transform']> {
        if (voice.released || !this.options.enabled) return []
        const steps = Math.round(Number(this.options.steps)), pulses = Math.min(steps, Math.round(Number(this.options.pulses)))
        const length = beatSeconds(this.timer) * Number(this.options.rate)
        const result = []
        if (euclideanStep(step, steps, pulses, Math.round(Number(this.options.rotation)))) {
            const accent = count % Math.max(1, pulses) < Number(this.options.accents)
            const on = this.start(voice, voice.input.number, this.now, voice.input.velocity * (accent ? 1 : Number(this.options.soft) / 100))
            result.push(on)
            this.schedule(this.now + length * Number(this.options.gate) / 100, () => [this.end(voice, on)], voice)
            count++
        }
        this.schedule(this.now + length, () => this.pulse(voice, (step + 1) % steps, count), voice)
        return result
    }
}
