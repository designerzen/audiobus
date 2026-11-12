import AbstractEffect from "./abstract-effect"
import { PHASER } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

const STAGES = 6

/** The LFO sweeps every stage's detune together; feedback runs through a one-block delay. */
export default class EffectPhaser extends AbstractEffect {
	private stages: BiquadFilterNode[]
	private oscillator: OscillatorNode
	private depth: GainNode
	private feedback: GainNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, PHASER, options)
		this.depth = this.node(context.createGain())
		this.feedback = this.node(context.createGain())
		this.oscillator = this.lfo(1)
		this.oscillator.connect(this.depth)
		this.stages = Array.from({ length: STAGES }, () => {
			const stage = this.node(context.createBiquadFilter())
			stage.type = "allpass"
			this.depth.connect(stage.detune)
			return stage
		})
		const last = this.stages.reduce<AudioNode>(
			(previous, stage) => previous.connect(stage),
			this.audioInput
		)
		// Web Audio silences cycles without a DelayNode.
		const loop = this.node(context.createDelay())
		last.connect(this.wet)
		last.connect(this.feedback).connect(loop).connect(this.stages[0])
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "rate") {
			this.glide(this.oscillator.frequency, value as number, immediate)
		} else if (id === "depth") {
			this.glide(this.depth.gain, (value as number) * 1200, immediate)
		} else if (id === "frequency") {
			this.stages.forEach((stage) => this.glide(stage.frequency, value as number, immediate))
		} else if (id === "feedback") {
			this.glide(this.feedback.gain, value as number, immediate)
		}
	}
}