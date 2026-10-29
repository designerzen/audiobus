import { PerformanceTransformer, routeKey, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'

export const ID_LATCH = 'Latch'
export class TransformerLatch extends PerformanceTransformer {
    protected type = ID_LATCH
    category = 'Duration'
    private held = new Map<string, Voice[]>()
    private collecting = new Set<string>()
    get name() { return 'Latch / Hold' }
    get description() { return 'Hold chords after key release, replacing them with the next chord or toggling individual notes.' }
    get instructions() { return 'Play and release a chord, then play the next one. Switch Enabled off to release everything immediately.' }
    constructor(config: Settings = {}) {
        super({ mode: 'replace', collect: 30 }, [
            { name: 'mode', label: 'Hold mode', values: ['replace', 'toggle'] },
            { name: 'collect', label: 'Chord window (ms)', values: [10, 20, 30, 50, 100], min: 1, max: 200 },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const key = routeKey(voice.input), held = this.held.get(key) ?? []
        let result: IAudioCommand[] = []
        if (this.options.mode === 'toggle') {
            const previous = held.find(previous => previous.input.number === voice.input.number)
            if (previous) {
                this.held.set(key, held.filter(item => item !== previous))
                this.voices.delete(voice)
                return this.release(previous)
            }
        } else if (!this.collecting.has(key)) {
            result = held.flatMap(previous => this.release(previous))
            held.length = 0
            this.collecting.add(key)
            this.schedule(this.now + Number(this.options.collect) / 1000, () => { this.collecting.delete(key); return [] }, undefined, key)
        }
        held.push(voice)
        this.held.set(key, held)
        return [...result, this.start(voice)]
    }
    protected noteOff() { return [] }
    protected clearState() { this.held?.clear(); this.collecting?.clear() }
    protected clearRoute(route: string) { this.held.delete(route); this.collecting.delete(route); return [] }
}
