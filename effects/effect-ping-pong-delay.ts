import AbstractEffect from "./abstract-effect"
import { NON_RESONANT_Q, PING_PONG_DELAY } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"

/** Mono input echoes first on the left, then alternates between the left and right speakers. */
export default class EffectPingPongDelay extends AbstractEffect {
	private left: DelayNode
	private right: DelayNode
	private feedback: GainNode
	private tone: BiquadFilterNode
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, PING_PONG_DELAY, options)
		const mono = this.node(context.createGain())
		mono.channelCount = 1
		mono.channelCountMode = "explicit"
		const merger = this.node(context.createChannelMerger(2))
		this.left = this.node(context.createDelay(2))
		this.right = this.node(context.createDelay(2))
		this.feedback = this.node(context.createGain())
		this.tone = this.node(context.createBiquadFilter())
		// Low-pass Q is in dB; any resonant peak would push the feedback loop above unity.
		this.tone.Q.value = NON_RESONANT_Q
		this.audioInput.connect(mono).connect(this.left).connect(this.right)
		this.right.connect(this.tone).connect(this.feedback).connect(this.left)
		this.left.connect(merger, 0, 0)
		this.right.connect(merger, 0, 1)
		merger.connect(this.wet)
		this.start()
	}
	protected apply(id: string, value: EffectValue, immediate: boolean) {
		if (id === "time") {
			this.glide(this.left.delayTime, value as number, immediate)
			this.glide(this.right.delayTime, value as number, immediate)
		} else if (id === "feedback") {
			this.glide(this.feedback.gain, value as number, immediate)
		} else if (id === "tone") {
			this.glide(this.tone.frequency, value as number, immediate)
		}
	}
}