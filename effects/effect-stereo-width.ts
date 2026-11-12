import AbstractEffect from "./abstract-effect"
import { STEREO_WIDTH } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/**
 * Scales the side signal: each speaker receives (1 + width) / 2 of its own channel
 * and (1 - width) / 2 of the other.
 */
export default class EffectStereoWidth extends AbstractEffect {
	private direct: GainNode[]
	private cross: GainNode[]
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, STEREO_WIDTH, options)
		const stereo = this.node(context.createGain())
		stereo.channelCount = 2
		stereo.channelCountMode = "explicit"
		const splitter = this.node(context.createChannelSplitter(2))
		const merger = this.node(context.createChannelMerger(2))
		this.direct = [0, 1].map(() => this.node(context.createGain()))
		this.cross = [0, 1].map(() => this.node(context.createGain()))
		this.audioInput.connect(stereo).connect(splitter)
		for (const channel of [0, 1]) {
			splitter.connect(this.direct[channel], channel).connect(merger, 0, channel)
			splitter.connect(this.cross[channel], channel).connect(merger, 0, 1 - channel)
		}
		merger.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "width") {
			const width = value as number
			this.direct.forEach((gain) => this.glide(gain.gain, (1 + width) / 2, immediate))
			this.cross.forEach((gain) => this.glide(gain.gain, (1 - width) / 2, immediate))
		}
	}
}