import { PerformanceTransformer, numbers, routeKey, type Settings, type Voice } from './performance-transformer.ts'

export const ID_POLYPHONY_LIMITER = 'Polyphony-Limiter'
export class TransformerPolyphonyLimiter extends PerformanceTransformer {
    protected type = ID_POLYPHONY_LIMITER
    category = 'Range'
    get name() { return 'Polyphony Limiter' }
    get description() { return 'Limit simultaneous notes per input channel with selectable voice-stealing priorities.' }
    constructor(config: Settings = {}) {
        super({ limit: 1, priority: 'oldest' }, [
            { name: 'limit', label: 'Maximum simultaneous notes', values: numbers(1, 32), min: 1, max: 32 },
            { name: 'priority', label: 'When full, discard', values: ['oldest', 'newest', 'quietest', 'lowest', 'highest'],
                help: 'Stolen notes stay silent until played again. Highest discards the highest pitch; lowest discards the lowest.' },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const active = [...this.voices].filter(candidate => candidate.targets.length && routeKey(candidate.input) === routeKey(voice.input))
        const result = []
        while (active.length >= Math.round(Number(this.options.limit))) {
            const candidates = [...active, voice]
            const victim = this.options.priority === 'newest' ? voice
                : this.options.priority === 'quietest' ? candidates.reduce((a, b) => a.input.velocity <= b.input.velocity ? a : b)
                    : this.options.priority === 'lowest' ? candidates.reduce((a, b) => a.input.number <= b.input.number ? a : b)
                        : this.options.priority === 'highest' ? candidates.reduce((a, b) => a.input.number >= b.input.number ? a : b)
                            : active[0]
            result.push(...this.release(victim))
            if (victim === voice) return result
            active.splice(active.indexOf(victim), 1)
        }
        result.push(this.start(voice))
        return result
    }
}
