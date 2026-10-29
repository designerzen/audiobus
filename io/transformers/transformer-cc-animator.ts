import { PerformanceTransformer, beatSeconds, copyCommand, numbers, routeKey, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import { CONTROL_CHANGE } from '../../commands'

export const ID_CC_ANIMATOR = 'CC-Animator'
interface Animation { voices: Set<Voice>; template: IAudioCommand; phase: number }
export class TransformerCCAnimator extends PerformanceTransformer {
    protected type = ID_CC_ANIMATOR
    category = 'Modulation'
    private animations = new Map<string, Animation>()
    get name() { return 'CC Animator' }
    get description() { return 'Animate a MIDI controller with a tempo-synced waveform while notes are held.' }
    constructor(config: Settings = {}) {
        super({ controller: 1, waveform: 'sine', beats: 4, minimum: 0, maximum: 100, retrigger: 1, restore: 0 }, [
            { name: 'controller', label: 'Controller', values: numbers(0, 119), min: 0, max: 119 },
            { name: 'waveform', label: 'Waveform', values: ['sine', 'triangle', 'square', 'ramp'] },
            { name: 'beats', label: 'Cycle length (beats)', values: [0.25, 0.5, 1, 2, 4, 8, 16], min: 0.25, max: 32 },
            { name: 'minimum', label: 'Minimum CC value', values: numbers(0, 127), min: 0, max: 127 },
            { name: 'maximum', label: 'Maximum CC value', values: numbers(0, 127), min: 0, max: 127 },
            { name: 'retrigger', label: 'Restart on each note', values: [0, 1], min: 0, max: 1 },
            { name: 'restore', label: 'CC value on release', values: numbers(0, 127), min: 0, max: 127 },
        ], config)
    }
    override setConfig(key: string, value: unknown) {
        // Restore the old destination before moving a running LFO to another CC.
        if (key === 'controller' && this.animations?.size && Number(value) !== Number(this.options.controller)) {
            const restore = this.stopControllers()
            this.schedule(this.now, () => restore)
        }
        super.setConfig(key, value)
    }
    private controller(template: IAudioCommand, value: number) {
        return copyCommand(template, { type: CONTROL_CHANGE, subtype: CONTROL_CHANGE, number: Number(this.options.controller), value: Math.round(value), velocity: 0, startAt: this.now })
    }
    protected noteOn(voice: Voice) {
        const key = routeKey(voice.input)
        let animation = this.animations.get(key)
        const fresh = !animation
        if (!animation) { animation = { voices: new Set(), template: voice.input, phase: 0 }; this.animations.set(key, animation) }
        animation.voices.add(voice)
        if (this.options.retrigger) animation.phase = 0
        return [this.start(voice), ...(fresh ? this.animate(key, animation) : [])]
    }
    private animate(key: string, animation: Animation): IAudioCommand[] {
        if (this.animations.get(key) !== animation || !animation.voices.size || !this.options.enabled) return []
        const p = animation.phase % 1
        const shape = this.options.waveform === 'triangle' ? 1 - Math.abs(2 * p - 1)
            : this.options.waveform === 'square' ? (p < 0.5 ? 1 : 0)
                : this.options.waveform === 'ramp' ? p : (1 - Math.cos(p * Math.PI * 2)) / 2
        const value = Number(this.options.minimum) + shape * (Number(this.options.maximum) - Number(this.options.minimum))
        // 50 Hz bounds traffic on hardware MIDI links.
        animation.phase += 0.02 / (beatSeconds(this.timer) * Number(this.options.beats))
        this.schedule(this.now + 0.02, () => this.animate(key, animation), undefined, key)
        return [this.controller(animation.template, value)]
    }
    protected noteOff(voice: Voice) {
        const key = routeKey(voice.input), animation = this.animations.get(key)
        animation?.voices.delete(voice)
        const result = this.release(voice)
        if (animation && !animation.voices.size) {
            this.animations.delete(key)
            result.push(this.controller(animation.template, Number(this.options.restore)))
        }
        return result
    }
    protected clearState() { this.animations?.clear() }
    protected clearRoute(route: string) {
        const animation = this.animations.get(route)
        this.animations.delete(route)
        return animation ? [this.controller(animation.template, Number(this.options.restore))] : []
    }
    protected stopControllers() {
        return [...this.animations.values()].map(animation => this.controller(animation.template, Number(this.options.restore)))
    }
}
