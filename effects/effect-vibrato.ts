import AbstractEffect from "./abstract-effect"
import { VIBRATO } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** A fully wet delay modulated around a resting time just beyond its depth. */
export default class EffectVibrato extends AbstractEffect {
	private delay: DelayNode
	private oscillator: OscillatorNode
	private depth: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, VIBRATO, options)
		this.delay = this.node(context.createDelay(0.1))
		this.depth = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth).connect(this.delay.delayTime)
		this.audioInput.connect(this.delay).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.glide(this.oscillator.frequency, value as number, immediate)
		} else if (id === "waveform") {
			this.oscillator.type = value as OscillatorType
		} else if (id === "depth") {
			const depth = (value as number) / 1000
			this.glide(this.depth.gain, depth, immediate)
			this.glide(this.delay.delayTime, depth + 0.001, immediate)
		}
	}
}