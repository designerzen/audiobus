import AbstractEffect from "./abstract-effect"
import { SNARE_REVERB } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"
import { generateRoomImpulse } from "./room-impulse"

/** The wet bus is attenuated so a full send sits under the dry hit, as in the original. */
const WET_LEVEL = 0.68

/** The dry sound passes untouched; amount sends it to a short, pre-delayed, high-passed room. */
export default class EffectSnareReverb extends AbstractEffect {
	private send: GainNode
	private preDelay: DelayNode
	private convolver: ConvolverNode
	private lowCut: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, SNARE_REVERB, options)
		this.send = this.node(context.createGain())
		this.preDelay = this.node(context.createDelay(0.1))
		this.convolver = this.node(context.createConvolver())
		this.lowCut = this.node(context.createBiquadFilter())
		const level = this.node(context.createGain())
		level.gain.value = WET_LEVEL
		this.lowCut.type = "highpass"
		this.lowCut.Q.value = 0.5
		this.audioInput.connect(this.wet)
		this.audioInput
			.connect(this.send)
			.connect(this.preDelay)
			.connect(this.convolver)
			.connect(this.lowCut)
			.connect(level)
			.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "amount") {
			this.glide(this.send.gain, value as number, immediate)
		} else if (id === "preDelay") {
			this.glide(this.preDelay.delayTime, (value as number) / 1000, immediate)
		} else if (id === "decay") {
			this.convolver.buffer = generateRoomImpulse(this.context, {
				length: value as number,
				tone: 0.2,
				preDelay: 0
			})
		} else if (id === "lowCut") {
			this.glide(this.lowCut.frequency, value as number, immediate)
		}
	}
}