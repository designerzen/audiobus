import AbstractEffect from "./abstract-effect"
import { LIMITER, dbToGain } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

const SAMPLES = 4096

/**
 * A hard-kneed, high-ratio compressor shapes peaks; the native compressor adds its own
 * makeup gain and cannot guarantee a ceiling, so a clipping curve enforces it.
 */
export default class EffectLimiter extends AbstractEffect {
	private compressor: DynamicsCompressorNode
	private clipper: WaveShaperNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, LIMITER, options)
		this.compressor = this.node(context.createDynamicsCompressor())
		this.compressor.ratio.value = 20
		this.compressor.knee.value = 0
		this.compressor.attack.value = 0
		this.clipper = this.node(context.createWaveShaper())
		this.clipper.oversample = "4x"
		this.audioInput.connect(this.compressor).connect(this.clipper).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "threshold") {
			this.glide(this.compressor.threshold, value as number, immediate)
		} else if (id === "release") {
			this.glide(this.compressor.release, value as number, immediate)
		} else if (id === "ceiling") {
			// Inputs beyond the curve's -1 to 1 domain take its end values, so they clip too.
			const ceiling = dbToGain(value as number)
			const curve = new Float32Array(SAMPLES)
			for (let index = 0; index < SAMPLES; index++) {
				const x = (index * 2) / (SAMPLES - 1) - 1
				curve[index] = Math.max(-ceiling, Math.min(ceiling, x))
			}
			this.clipper.curve = curve
		}
	}
}