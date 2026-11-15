import AbstractEffect from "./abstract-effect"
import { CHANNEL_STRIP } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"
import { createExpressionStage, type ExpressionStage } from "./expression-stage"

/** Slower than other glides so a pan driven every frame never steps audibly. */
const PAN_SMOOTHING = 0.06
const GAIN_SMOOTHING = 0.015

/**
 * One player's signal path: gain, switchable echo, pan, switchable compressor, expression
 * and trim. Switches crossfade between paths that stay connected, so toggling never clicks.
 */
export default class EffectChannelStrip extends AbstractEffect {
	private gain: GainNode
	private delay: DelayNode
	private feedback: GainNode
	private echo: GainNode
	private panner: StereoPannerNode
	private bypass: GainNode
	private compressor: DynamicsCompressorNode
	private compressed: GainNode
	private stage: ExpressionStage
	private trim: GainNode
	private scheduledAt?: number
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, CHANNEL_STRIP, options)
		this.gain = this.node(context.createGain())
		this.delay = this.node(context.createDelay(2))
		this.feedback = this.node(context.createGain())
		this.echo = this.node(context.createGain())
		const echoMix = this.node(context.createGain())
		this.panner = this.node(context.createStereoPanner())
		this.bypass = this.node(context.createGain())
		this.compressor = this.node(context.createDynamicsCompressor())
		this.compressed = this.node(context.createGain())
		const compressorMix = this.node(context.createGain())
		this.stage = createExpressionStage(context, (created) => this.node(created))
		this.trim = this.node(context.createGain())

		this.audioInput.connect(this.gain).connect(echoMix)
		this.gain.connect(this.delay).connect(this.feedback).connect(this.delay)
		this.delay.connect(this.echo).connect(echoMix)
		echoMix.connect(this.panner)
		this.panner.connect(this.bypass).connect(compressorMix)
		this.panner.connect(this.compressor).connect(this.compressed).connect(compressorMix)
		compressorMix.connect(this.stage.input)
		this.stage.output.connect(this.trim).connect(this.wet)
		this.start()
	}

	/** Sets the stereo position, -1 (left) to 1 (right). */
	setPan(value: number): void {
		this.setParameter("pan", value)
	}

	/** Sets the input gain, optionally from a time on the context clock. */
	setGain(value: number, atTime?: number): void {
		this.scheduledAt = atTime
		this.setParameter("gain", value)
		this.scheduledAt = undefined
	}

	/** Sets how far the expression stage is applied, 0 to 1. */
	setExpression(value: number): void {
		this.setParameter("expression", value)
	}

	protected apply(id: string, value: EffectValue, immediate: boolean) {
		const { options } = this
		if (id === "gain") {
			if (immediate) {
				this.gain.gain.value = value as number
			} else {
				this.gain.gain.setTargetAtTime(
					value as number,
					this.scheduledAt ?? this.context.currentTime,
					GAIN_SMOOTHING
				)
			}
		} else if (id === "pan") {
			if (immediate) {
				this.panner.pan.value = value as number
			} else {
				this.panner.pan.setTargetAtTime(
					value as number,
					this.context.currentTime,
					PAN_SMOOTHING
				)
			}
		} else if (id === "trim") {
			this.glide(this.trim.gain, value as number, immediate)
		} else if (id.startsWith("delay")) {
			const on = options.delay === "on"
			this.glide(this.delay.delayTime, options.delayTime as number, immediate)
			this.glide(this.feedback.gain, on ? (options.delayFeedback as number) : 0, immediate)
			this.glide(this.echo.gain, on ? (options.delayLevel as number) : 0, immediate)
		} else if (id === "compressor") {
			const on = value === "on"
			this.glide(this.bypass.gain, on ? 0 : 1, immediate)
			this.glide(this.compressed.gain, on ? 1 : 0, immediate)
		} else if (id.startsWith("expression")) {
			this.stage.update(
				options.expression as number,
				{
					filter: options.expressionFilter as number,
					compression: options.expressionCompression as number,
					echo: options.expressionEcho as number,
					reverb: options.expressionReverb as number
				},
				immediate
			)
		} else {
			const param = {
				threshold: this.compressor.threshold,
				ratio: this.compressor.ratio,
				knee: this.compressor.knee,
				attack: this.compressor.attack,
				release: this.compressor.release
			}[id]
			if (param) {
				this.glide(param, value as number, immediate)
			}
		}
	}
}