import AbstractEffect from "./abstract-effect"
import { COMPRESSOR, dbToGain } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

export default class EffectCompressor extends AbstractEffect {
	private compressor: DynamicsCompressorNode
	private makeup: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, COMPRESSOR, options)
		this.compressor = this.node(context.createDynamicsCompressor())
		this.makeup = this.node(context.createGain())
		this.audioInput.connect(this.compressor).connect(this.makeup).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "makeup") {
			this.glide(this.makeup.gain, dbToGain(value as number), immediate)
			return
		}
		const param = {
			threshold: this.compressor.threshold,
			ratio: this.compressor.ratio,
			knee: this.compressor.knee,
			attack: this.compressor.attack,
			release: this.compressor.release
		}[id]
		if (param) {
			this.glide(param, value as number, immediate)
		}
	}
}