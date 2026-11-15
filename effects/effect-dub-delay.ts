import AbstractEffect from "./abstract-effect"
import { DUB_DELAY } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** Slow enough that changing the time sweeps the echoes' pitch like a tape machine. */
const TIME_GLIDE = 0.25

/** Feedback delay whose repeats are tapped after the loop's low-pass, so each pass is darker. */
export default class EffectDubDelay extends AbstractEffect {
	private delay: DelayNode
	private feedback: GainNode
	private filter: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, DUB_DELAY, options)
		this.delay = this.node(context.createDelay(2.5))
		this.feedback = this.node(context.createGain())
		// The default 1 dB resonance gives the dub bite; the feedback limit allows for it.
		this.filter = this.node(context.createBiquadFilter())
		this.audioInput.connect(this.delay).connect(this.feedback).connect(this.filter)
		this.filter.connect(this.delay)
		this.filter.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "time") {
			if (immediate) {
				this.delay.delayTime.value = value as number
			} else {
				this.delay.delayTime.setTargetAtTime(
					value as number,
					this.context.currentTime,
					TIME_GLIDE
				)
			}
		} else if (id === "feedback") {
			this.glide(this.feedback.gain, value as number, immediate)
		} else if (id === "filter") {
			this.glide(this.filter.frequency, value as number, immediate)
		}
	}
}