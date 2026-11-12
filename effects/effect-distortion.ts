import AbstractEffect from "./abstract-effect"
import { DISTORTION, dbToGain } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

const SAMPLES = 4096

/** Builds a transfer curve from -1 to 1; drive runs from 0 to 100. */
export const distortionCurve = (character: string, drive: number): Float32Array<ArrayBuffer> => {
	const curve = new Float32Array(SAMPLES)
	const k = 1 + drive / 4
	for (let index = 0; index < SAMPLES; index++) {
		const x = (index * 2) / (SAMPLES - 1) - 1
		switch (character) {
			case "hard":
				curve[index] = Math.max(-1, Math.min(1, x * (1 + drive / 10)))
				break
			case "fuzz":
				curve[index] =
					x >= 0
						? (1 - Math.exp(-k * x)) / (1 - Math.exp(-k))
						: (-0.6 * (1 - Math.exp(k * 1.5 * x))) / (1 - Math.exp(-k * 1.5))
				break
			case "fold":
				curve[index] = Math.sin(x * (1 + drive / 10) * (Math.PI / 2))
				break
			default:
				curve[index] = Math.tanh(k * x) / Math.tanh(k)
		}
	}
	return curve
}

export default class EffectDistortion extends AbstractEffect {
	private shaper: WaveShaperNode
	private tone: BiquadFilterNode
	private level: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, DISTORTION, options)
		this.shaper = this.node(context.createWaveShaper())
		this.shaper.oversample = "4x"
		this.tone = this.node(context.createBiquadFilter())
		this.level = this.node(context.createGain())
		this.audioInput
			.connect(this.shaper)
			.connect(this.tone)
			.connect(this.level)
			.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "curve" || id === "drive") {
			this.shaper.curve = distortionCurve(
				this.options.curve as string,
				this.options.drive as number
			)
		} else if (id === "tone") {
			this.glide(this.tone.frequency, value as number, immediate)
		} else if (id === "level") {
			this.glide(this.level.gain, dbToGain(value as number), immediate)
		}
	}
}