import AbstractEffect from "./abstract-effect"
import { EQ } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

export default class EffectEQ extends AbstractEffect {
	private low: BiquadFilterNode
	private mid: BiquadFilterNode
	private high: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, EQ, options)
		this.low = this.node(context.createBiquadFilter())
		this.mid = this.node(context.createBiquadFilter())
		this.high = this.node(context.createBiquadFilter())
		this.low.type = "lowshelf"
		this.mid.type = "peaking"
		this.high.type = "highshelf"
		this.audioInput.connect(this.low).connect(this.mid).connect(this.high).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		const param = {
			lowGain: this.low.gain,
			lowFrequency: this.low.frequency,
			midGain: this.mid.gain,
			midFrequency: this.mid.frequency,
			midQ: this.mid.Q,
			highGain: this.high.gain,
			highFrequency: this.high.frequency
		}[id]
		if (param) {
			this.glide(param, value as number, immediate)
		}
	}
}