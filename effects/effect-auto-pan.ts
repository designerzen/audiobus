import AbstractEffect from "./abstract-effect"
import { AUTO_PAN } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

export default class EffectAutoPan extends AbstractEffect {
	private oscillator: OscillatorNode
	private depth: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, AUTO_PAN, options)
		const panner = this.node(context.createStereoPanner())
		this.depth = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth).connect(panner.pan)
		this.audioInput.connect(panner).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.glide(this.oscillator.frequency, value as number, immediate)
		} else if (id === "depth") {
			this.glide(this.depth.gain, value as number, immediate)
		} else if (id === "waveform") {
			this.oscillator.type = value as OscillatorType
		}
	}
}