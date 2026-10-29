import { PerformanceTransformer, beatSeconds, routeKey, type Settings, type Voice } from './performance-transformer.ts'

export const ID_LEGATO = 'Legato'
export class TransformerLegato extends PerformanceTransformer {
    protected type = ID_LEGATO
    category = 'Duration'
    private held = new Map<string, Voice>()
    get name() { return 'Legato' }
    get description() { return 'Connect a monophonic line until the next note, with adjustable overlap and a maximum hold.' }
    get instructions() { return 'Play a melody. Each note lasts until the next note on its input channel, or until Maximum hold expires.' }
    constructor(config: Settings = {}) {
        super({ overlap: 20, hold: 4 }, [
            { name: 'overlap', label: 'Overlap (ms)', values: [0, 5, 10, 20, 40, 80, 120], min: 0, max: 200 },
            { name: 'hold', label: 'Maximum hold (beats)', values: [0.5, 1, 2, 4, 8, 16], min: 0.25, max: 32 },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const key = routeKey(voice.input), previous = this.held.get(key)
        const result = []
        if (previous) {
            if (previous.input.number === voice.input.number || !this.options.overlap) result.push(...this.release(previous))
            else this.schedule(this.now + Number(this.options.overlap) / 1000, () => this.release(previous))
        }
        this.held.set(key, voice)
        result.push(this.start(voice))
        this.schedule(this.now + beatSeconds(this.timer) * Number(this.options.hold), () => {
            if (this.held.get(key) === voice) this.held.delete(key)
            return this.release(voice)
        }, voice)
        return result
    }
    protected noteOff() { return [] }
    protected clearState() { this.held?.clear() }
    protected clearRoute(route: string) { this.held.delete(route); return [] }
}
