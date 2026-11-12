import AbstractEffect from "./abstract-effect"
import { UTILITY, dbToGain } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

export default class EffectUtility extends AbstractEffect {
	private level: GainNode
	private panner: StereoPannerNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, UTILITY, options)
		this.level = this.node(context.createGain())
		this.panner = this.node(context.createStereoPanner())
		this.audioInput.connect(this.level).connect(this.panner).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "pan") {
			this.glide(this.panner.pan, value as number, immediate)
		} else if (id === "gain" || id === "polarity") {
			const sign = this.options.polarity === "inverted" ? -1 : 1
			this.glide(this.level.gain, sign * dbToGain(this.options.gain as number), immediate)
		}
	}
}