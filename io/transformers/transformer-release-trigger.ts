import { PerformanceTransformer, beatSeconds, copyCommand, routeKey, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'

export const ID_RELEASE_TRIGGER = 'Release-Trigger'
export class TransformerReleaseTrigger extends PerformanceTransformer {
    protected type = ID_RELEASE_TRIGGER
    category = 'Duration'
    private armed = new Set<Voice>()
    get name() { return 'Release Trigger' }
    get description() { return 'Trigger a short note when a key is released, optionally keeping its original attack.' }
    get instructions() { return 'Press a key, then release it to hear the triggered note. Keep attack adds the release sound to your normal playing.' }
    constructor(config: Settings = {}) {
        super({ beats: 0.25, transpose: 0, level: 100, velocitySource: 'attack', dry: 0 }, [
            { name: 'beats', label: 'Release note length (beats)', values: [0.0625, 0.125, 0.25, 0.5, 1, 2], min: 0.03125, max: 4 },
            { name: 'transpose', label: 'Release transposition', values: [-24, -12, -7, -5, 0, 5, 7, 12, 24], min: -48, max: 48 },
            { name: 'level', label: 'Release velocity (%)', values: [25, 50, 75, 100, 125], min: 1, max: 200 },
            { name: 'velocitySource', label: 'Velocity source', values: ['attack', 'release'], help: 'Release mode falls back to attack velocity when the keyboard sends no release velocity.' },
            { name: 'dry', label: 'Keep attack', values: [0, 1], min: 0, max: 1 },
        ], config)
    }
    protected noteOn(voice: Voice) { this.armed.add(voice); return this.options.dry ? [this.start(voice)] : [] }
    protected noteOff(voice: Voice, command: IAudioCommand) {
        const result = this.release(voice)
        if (!this.armed.delete(voice)) return result
        const pitch = voice.input.number + Number(this.options.transpose)
        if (!this.options.enabled || pitch < 0 || pitch > 127) return result
        const tail: Voice = { input: copyCommand(voice.input), targets: [], released: true }
        this.voices.add(tail)
        const velocity = this.options.velocitySource === 'release' && command.velocity > 0 ? command.velocity : voice.input.velocity
        result.push(this.start(tail, pitch, this.now, velocity * Number(this.options.level) / 100))
        this.schedule(this.now + beatSeconds(this.timer) * Number(this.options.beats), () => this.release(tail), tail)
        return result
    }
    protected clearState() { this.armed?.clear() }
    protected clearRoute(route: string) {
        for (const voice of this.armed) if (routeKey(voice.input) === route) this.armed.delete(voice)
        return []
    }
}
