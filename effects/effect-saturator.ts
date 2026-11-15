import AbstractEffect from "./abstract-effect"
import { SATURATOR, dbToGain } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

const SAMPLES = 8192

/**
 * A fixed asymmetric transfer curve: positive peaks stop near 0.63 while negative peaks
 * run nearly to full scale, which is what adds even harmonics.
 */
export const saturatorCurve = (): Float32Array<ArrayBuffer> => {
	const curve = new Float32Array(SAMPLES)
	for (let index = 0; index < SAMPLES; index++) {
		const x = (index * 2) / (SAMPLES - 1) - 1
		if (x < -0.08905) {
			const magnitude = Math.abs(x) - 0.032857
			curve[index] = -0.75 * (1 - (1 - magnitude) ** 12 + magnitude / 3) + 0.01
		} else if (x < 0.320018) {
			curve[index] = -6.153 * x * x + 3.9375 * x
		} else {
			curve[index] = 0.630035
		}
	}
	return curve
}

export default class EffectSaturator extends AbstractEffect {
	private drive: GainNode
	private level: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, SATURATOR, options)
		this.drive = this.node(context.createGain())
		const shaper = this.node(context.createWaveShaper())
		shaper.curve = saturatorCurve()
		shaper.oversample = "2x"
		this.level = this.node(context.createGain())
		this.audioInput.connect(this.drive).connect(shaper).connect(this.level).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "drive") {
			this.glide(this.drive.gain, dbToGain(value as number), immediate)
		} else if (id === "level") {
			this.glide(this.level.gain, dbToGain(value as number), immediate)
		}
	}
}