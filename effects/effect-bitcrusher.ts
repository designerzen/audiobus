import AbstractEffect from "./abstract-effect"
import { BITCRUSHER } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

// Enough points that interpolation between neighbours barely softens each step.
const SAMPLES = 65536

/** Quantises amplitude to 2^bits levels with a staircase transfer curve. */
export const bitcrusherCurve = (bits: number): Float32Array<ArrayBuffer> => {
	const curve = new Float32Array(SAMPLES)
	const steps = Math.pow(2, bits) / 2
	for (let index = 0; index < SAMPLES; index++) {
		const x = (index * 2) / (SAMPLES - 1) - 1
		curve[index] = Math.max(-1, Math.min(1, Math.round(x * steps) / steps))
	}
	return curve
}

export default class EffectBitcrusher extends AbstractEffect {
	private shaper: WaveShaperNode
	private tone: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, BITCRUSHER, options)
		this.shaper = this.node(context.createWaveShaper())
		this.tone = this.node(context.createBiquadFilter())
		this.audioInput.connect(this.shaper).connect(this.tone).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "bits") {
			this.shaper.curve = bitcrusherCurve(value as number)
		} else if (id === "tone") {
			this.glide(this.tone.frequency, value as number, immediate)
		}
	}
}