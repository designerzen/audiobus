import AbstractEffect from "./abstract-effect"
import { NON_RESONANT_Q, DELAY } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** Feedback delay whose repeats pass through a low-pass tone filter. */
export default class EffectDelay extends AbstractEffect {
	private delay: DelayNode
	private feedback: GainNode
	private tone: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, DELAY, options)
		this.delay = this.node(context.createDelay(2))
		this.feedback = this.node(context.createGain())
		this.tone = this.node(context.createBiquadFilter())
		// Low-pass Q is in dB; any resonant peak would push the feedback loop above unity.
		this.tone.Q.value = NON_RESONANT_Q
		this.audioInput.connect(this.delay).connect(this.tone).connect(this.wet)
		this.tone.connect(this.feedback).connect(this.delay)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		const param = {
			time: this.delay.delayTime,
			feedback: this.feedback.gain,
			tone: this.tone.frequency
		}[id]
		if (param) {
			this.glide(param, value as number, immediate)
		}
	}
}