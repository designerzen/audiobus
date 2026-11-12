import AbstractEffect from "./abstract-effect"
import { CHORUS } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** Delay never sweeps below this, so the LFO is never clamped at zero. */
const MINIMUM_DELAY = 0.001

/** Each speaker's channel passes through its own modulated delay, with LFOs a quarter cycle apart. */
export default class EffectChorus extends AbstractEffect {
	private delays: DelayNode[]
	private oscillators: OscillatorNode[]
	private depths: GainNode[]
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, CHORUS, options)
		const stereo = this.node(context.createGain())
		stereo.channelCount = 2
		stereo.channelCountMode = "explicit"
		const splitter = this.node(context.createChannelSplitter(2))
		const merger = this.node(context.createChannelMerger(2))
		const cosine = context.createPeriodicWave(new Float32Array([0, 1]), new Float32Array(2))
		this.delays = [0, 1].map(() => this.node(context.createDelay(0.1)))
		this.depths = [0, 1].map(() => this.node(context.createGain()))
		this.oscillators = [0, 1].map(() => this.lfo(1))
		this.oscillators[1].setPeriodicWave(cosine)
		this.audioInput.connect(stereo).connect(splitter)
		this.delays.forEach((delay, channel) => {
			this.oscillators[channel].connect(this.depths[channel]).connect(delay.delayTime)
			splitter.connect(delay, channel).connect(merger, 0, channel)
		})
		merger.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.oscillators.forEach((oscillator) =>
				this.glide(oscillator.frequency, value as number, immediate)
			)
		} else if (id === "depth" || id === "delay") {
			const depth = (this.options.depth as number) / 1000
			const delay = Math.max((this.options.delay as number) / 1000, depth + MINIMUM_DELAY)
			this.depths.forEach((gain) => this.glide(gain.gain, depth, immediate))
			this.delays.forEach((node) => this.glide(node.delayTime, delay, immediate))
		}
	}
}