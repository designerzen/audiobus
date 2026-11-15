import { createReverbImpulseResponse } from "./reverb"

/** Time constant for expression changes, short enough to follow a per-frame control. */
const SMOOTHING = 0.025

export interface ExpressionDepths {
	filter: number
	compression: number
	echo: number
	reverb: number
}

export interface ExpressionStage {
	input: GainNode
	output: GainNode
	/** Moves every stage to its position for amount (0..1), each scaled by its own depth. */
	update(amount: number, depths: ExpressionDepths, immediate: boolean): void
}

/**
 * Low-pass, compressor, echo and reverb that all deepen together as amount rises. At
 * amount 0 every stage is transparent, so the graph never needs rewiring.
 */
export const createExpressionStage = (
	context: BaseAudioContext,
	node: <T extends AudioNode>(created: T) => T
): ExpressionStage => {
	const input = node(context.createGain())
	const output = node(context.createGain())
	const filter = node(context.createBiquadFilter())
	const compressor = node(context.createDynamicsCompressor())
	const delay = node(context.createDelay(1))
	const feedback = node(context.createGain())
	const echo = node(context.createGain())
	const echoMix = node(context.createGain())
	const reverb = node(context.createConvolver())
	const reverbWet = node(context.createGain())
	const reverbMix = node(context.createGain())
	const open = Math.min(20000, context.sampleRate / 2)
	const closed = Math.min(300, open)

	filter.Q.value = 0.7
	delay.delayTime.value = 0.25
	reverb.buffer = createReverbImpulseResponse(context, 1.5, 3)
	input.connect(filter).connect(compressor).connect(echoMix)
	compressor.connect(delay).connect(feedback).connect(delay)
	delay.connect(echo).connect(echoMix)
	echoMix.connect(reverbMix)
	echoMix.connect(reverb).connect(reverbWet).connect(reverbMix)
	reverbMix.connect(output)

	const set = (param: AudioParam, value: number, immediate: boolean) => {
		if (immediate) {
			param.value = value
		} else {
			param.setTargetAtTime(value, context.currentTime, SMOOTHING)
		}
	}
	return {
		input,
		output,
		update(amount, depths, immediate) {
			const compressed = amount * depths.compression
			const echoed = amount * depths.echo
			set(filter.frequency, open * (closed / open) ** (amount * depths.filter), immediate)
			set(compressor.threshold, -6 - compressed * 42, immediate)
			set(compressor.ratio, 1 + compressed * 11, immediate)
			set(echo.gain, echoed * 0.5, immediate)
			set(feedback.gain, echoed * 0.45, immediate)
			set(reverbWet.gain, amount * depths.reverb * 0.6, immediate)
		}
	}
}