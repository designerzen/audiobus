import AbstractEffect from "./abstract-effect"
import { REVERB } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"
import { createReverbImpulseResponse } from "./reverb"

/** Convolution with a generated, exponentially decaying noise impulse. */
export default class EffectReverb extends AbstractEffect {
	private preDelay: DelayNode
	private convolver: ConvolverNode
	private brightness: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, REVERB, options)
		this.preDelay = this.node(context.createDelay(1))
		this.convolver = this.node(context.createConvolver())
		this.brightness = this.node(context.createBiquadFilter())
		this.audioInput
			.connect(this.preDelay)
			.connect(this.convolver)
			.connect(this.brightness)
			.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "decay") {
			this.convolver.buffer = createReverbImpulseResponse(this.context, value as number, 3)
		} else if (id === "preDelay") {
			this.glide(this.preDelay.delayTime, (value as number) / 1000, immediate)
		} else if (id === "brightness") {
			this.glide(this.brightness.frequency, value as number, immediate)
		}
	}
}