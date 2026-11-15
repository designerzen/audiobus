import AbstractEffect from "./abstract-effect"
import { DRUM_BUS } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/**
 * A heavy compressor into a plain high-ratio compressor acting as a limiter, with no
 * clipper, so it matches the percussion bus it comes from rather than the Limiter effect.
 */
export default class EffectDrumBus extends AbstractEffect {
	private compressor: DynamicsCompressorNode
	private limiter: DynamicsCompressorNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, DRUM_BUS, options)
		this.compressor = this.node(context.createDynamicsCompressor())
		this.limiter = this.node(context.createDynamicsCompressor())
		this.limiter.knee.value = 0
		this.limiter.ratio.value = 20
		this.limiter.attack.value = 0.001
		this.audioInput.connect(this.compressor).connect(this.limiter).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		const param = {
			threshold: this.compressor.threshold,
			knee: this.compressor.knee,
			ratio: this.compressor.ratio,
			attack: this.compressor.attack,
			release: this.compressor.release,
			limitThreshold: this.limiter.threshold,
			limitRelease: this.limiter.release
		}[id]
		if (param) {
			this.glide(param, value as number, immediate)
		}
	}
}