import AbstractEffect from "./abstract-effect"
import { TREMOLO } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** Gain swings between 1 and 1 - depth around a resting level of 1 - depth / 2. */
export default class EffectTremolo extends AbstractEffect {
	private amplitude: GainNode
	private oscillator: OscillatorNode
	private depth: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, TREMOLO, options)
		this.amplitude = this.node(context.createGain())
		this.depth = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth).connect(this.amplitude.gain)
		this.audioInput.connect(this.amplitude).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.glide(this.oscillator.frequency, value as number, immediate)
		} else if (id === "waveform") {
			this.oscillator.type = value as OscillatorType
		} else if (id === "depth") {
			this.glide(this.amplitude.gain, 1 - (value as number) / 2, immediate)
			this.glide(this.depth.gain, (value as number) / 2, immediate)
		}
	}
}