import { PerformanceTransformer, beatSeconds, type Settings, type Voice } from './performance-transformer.ts'

export const ID_ORNAMENTER = 'Ornamenter'
export class TransformerOrnamenter extends PerformanceTransformer {
    protected type = ID_ORNAMENTER
    category = 'Pattern'
    get name() { return 'Ornamenter' }
    get description() { return 'Add after-beat grace notes, flams, mordents or trills to live notes.' }
    constructor(config: Settings = {}) {
        super({ style: 'mordent', interval: 2, count: 4, rate: 0.125, chance: 100, level: 75 }, [
            { name: 'style', label: 'Ornament', values: ['grace', 'flam', 'mordent', 'trill'] },
            { name: 'interval', label: 'Interval (semitones)', values: [-12, -7, -5, -3, -2, -1, 1, 2, 3, 5, 7, 12], min: -24, max: 24 },
            { name: 'count', label: 'Trill notes', values: [2, 4, 6, 8, 12, 16], min: 2, max: 16 },
            { name: 'rate', label: 'Ornament step (beats)', values: [0.0625, 0.125, 0.25, 0.5], min: 0.0625, max: 0.5 },
            { name: 'chance', label: 'Chance (%)', values: [0, 10, 25, 50, 75, 100], min: 0, max: 100 },
            { name: 'level', label: 'Ornament velocity (%)', values: [25, 50, 75, 100], min: 1, max: 100 },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const initial = this.start(voice)
        if (Math.random() * 100 >= Number(this.options.chance)) return [initial]
        const interval = Number(this.options.interval), pitch = voice.input.number
        const pattern = this.options.style === 'flam' ? [pitch]
            : this.options.style === 'grace' ? [pitch + interval, pitch]
                : this.options.style === 'mordent' ? [pitch + interval, pitch]
                    : Array.from({ length: Math.round(Number(this.options.count)) }, (_, i) => pitch + (i % 2 ? 0 : interval))
        const length = beatSeconds(this.timer) * Number(this.options.rate)
        let previous = initial
        for (const [index, note] of pattern.entries()) {
            this.schedule(this.now + (index + 1) * length, () => {
                const off = this.end(voice, previous)
                previous = this.start(voice, note, this.now, voice.input.velocity * (index === pattern.length - 1 ? 1 : Number(this.options.level) / 100))
                return [off, previous]
            }, voice)
        }
        return [initial]
    }
}
