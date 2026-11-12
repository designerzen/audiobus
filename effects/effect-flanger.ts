import AbstractEffect from "./abstract-effect"
import { FLANGER } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

const RENDER_QUANTUM = 128

export default class EffectFlanger extends AbstractEffect {
	private delay: DelayNode
	private feedback: GainNode
	private oscillator: OscillatorNode
	private depth: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, FLANGER, options)
		this.delay = this.node(context.createDelay(0.1))
		this.feedback = this.node(context.createGain())
		this.depth = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth).connect(this.delay.delayTime)
		this.audioInput.connect(this.delay).connect(this.wet)
		this.delay.connect(this.feedback).connect(this.delay)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.glide(this.oscillator.frequency, value as number, immediate)
		} else if (id === "depth" || id === "delay") {
			// A DelayNode inside a feedback cycle cannot go below one render quantum, so the
			// resting delay keeps the whole sweep above it rather than flattening at the bottom.
			const depth = (this.options.depth as number) / 1000
			const minimum = RENDER_QUANTUM / this.context.sampleRate
			const delay = Math.max((this.options.delay as number) / 1000, depth + minimum)
			this.glide(this.depth.gain, depth, immediate)
			this.glide(this.delay.delayTime, delay, immediate)
		} else if (id === "feedback") {
			this.glide(this.feedback.gain, value as number, immediate)
		}
	}
}