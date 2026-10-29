import { PerformanceTransformer, routeKey, type Settings, type Voice } from './performance-transformer.ts'

export const ID_STRUMMER = 'Strummer'
export class TransformerStrummer extends PerformanceTransformer {
    protected type = ID_STRUMMER
    category = 'Timing'
    private chords = new Map<string, Voice[]>()
    private strokes = new Map<string, number>()
    get name() { return 'Strummer' }
    get description() { return 'Play each chord as one upstroke or downstroke, with an optional alternating direction.' }
    get instructions() { return 'Play a chord. Notes arriving within the collection window become one stroke; releasing a key cancels its unheard notes.' }
    constructor(config: Settings = {}) {
        super({ direction: 'alternate', spread: 80, collect: 25, falloff: 10 }, [
            { name: 'direction', label: 'Stroke direction', values: ['up', 'down', 'alternate'] },
            { name: 'spread', label: 'Whole stroke (ms)', values: [0, 20, 40, 60, 80, 120, 200, 400], min: 0, max: 1000 },
            { name: 'collect', label: 'Collection window (ms)', values: [0, 10, 20, 25, 40, 60, 100], min: 0, max: 200 },
            { name: 'falloff', label: 'Velocity falloff (%)', values: [0, 10, 20, 30, 50], min: 0, max: 90 },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const key = routeKey(voice.input)
        let chord = this.chords.get(key)
        if (!chord) {
            chord = []
            this.chords.set(key, chord)
            this.schedule(this.now + Number(this.options.collect) / 1000, () => this.strum(key), undefined, key)
        }
        chord.push(voice)
        return []
    }
    private strum(key: string) {
        const chord = (this.chords.get(key) ?? []).filter(voice => !voice.released).sort((a, b) => a.input.number - b.input.number)
        this.chords.delete(key)
        const stroke = this.strokes.get(key) ?? 0
        if (this.options.direction === 'down' || (this.options.direction === 'alternate' && stroke % 2)) chord.reverse()
        this.strokes.set(key, stroke + 1)
        for (const [index, voice] of chord.entries()) {
            this.schedule(this.now + index * Number(this.options.spread) / 1000 / Math.max(1, chord.length - 1), () =>
                voice.released ? [] : [this.start(voice, voice.input.number, this.now,
                    voice.input.velocity * (1 - index / Math.max(1, chord.length - 1) * Number(this.options.falloff) / 100))], voice)
        }
        return []
    }
    protected clearState() { this.chords?.clear(); this.strokes?.clear() }
    protected clearRoute(route: string) { this.chords.delete(route); this.strokes.delete(route); return [] }
}
