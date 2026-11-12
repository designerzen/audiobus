import AbstractEffect from "./abstract-effect"
import { FILTER } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

export default class EffectFilter extends AbstractEffect {
	private filter: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, FILTER, options)
		this.filter = this.node(context.createBiquadFilter())
		this.audioInput.connect(this.filter).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "filterType") {
			this.filter.type = value as BiquadFilterType
			return
		}
		const param = {
			frequency: this.filter.frequency,
			q: this.filter.Q,
			gain: this.filter.gain
		}[id]
		if (param) {
			this.glide(param, value as number, immediate)
		}
	}
}