import AbstractEffect from "./abstract-effect"
import { AUTO_FILTER } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** The LFO sweeps the filter's detune in cents, so depth is an even number of octaves. */
export default class EffectAutoFilter extends AbstractEffect {
	private filter: BiquadFilterNode
	private oscillator: OscillatorNode
	private depth: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, AUTO_FILTER, options)
		this.filter = this.node(context.createBiquadFilter())
		this.depth = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth).connect(this.filter.detune)
		this.audioInput.connect(this.filter).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "filterType") {
			this.filter.type = value as BiquadFilterType
		} else if (id === "waveform") {
			this.oscillator.type = value as OscillatorType
		} else if (id === "depth") {
			this.glide(this.depth.gain, (value as number) * 1200, immediate)
		} else {
			const param = {
				frequency: this.filter.frequency,
				q: this.filter.Q,
				rate: this.oscillator.frequency
			}[id]
			if (param) {
				this.glide(param, value as number, immediate)
			}
		}
	}
}