import AbstractEffect from "./abstract-effect"
import { RING_MODULATOR } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** The carrier drives a gain that rests at zero, multiplying it with the input. */
export default class EffectRingModulator extends AbstractEffect {
	private carrier: OscillatorNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, RING_MODULATOR, options)
		const modulator = this.node(context.createGain())
		modulator.gain.value = 0
		this.carrier = this.lfo(440)
		this.carrier.connect(modulator.gain)
		this.audioInput.connect(modulator).connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "frequency") {
			this.glide(this.carrier.frequency, value as number, immediate)
		} else if (id === "waveform") {
			this.carrier.type = value as OscillatorType
		}
	}
}