import PhotoSynthOutput, {
	commonParameters,
	pitchControl,
	numeric,
	noiseBuffer,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph
} from "../../instruments/photosynth/output-base.ts"
import { NON_RESONANT_Q } from "../../effects/effect-definitions.ts"

export interface WaveguideSettings extends CommonSettings {
	detune: number
	feedback: number
	cutoff: number
	resonance: number
	burstDuration: number
}
export type WaveguideOptions = OutputOptions<WaveguideSettings>
const parameters: Parameters<WaveguideSettings> = {
	...commonParameters,
	sustain: numeric(1, 0, 1),
	detune: numeric(0, -1200, 1200, 1),
	feedback: numeric(0.96, 0, 0.999),
	cutoff: numeric(2200, 20, 20000, 1),
	resonance: numeric(0, 0, 0.7),
	burstDuration: numeric(0.01, 0.001, 0.1, 0.001)
}

export default class OutputWaveguide extends PhotoSynthOutput<WaveguideSettings> {
	readonly name = "Waveguide"
	readonly description = "Noise-excited plucked strings with a damped delay feedback loop"
	constructor(options: WaveguideOptions) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { context, settings } = this
		const excitation = context.createBufferSource()
		excitation.buffer = noiseBuffer(context, settings.burstDuration)
		const delay = context.createDelay(2)
		const feedback = context.createGain()
		const filter = context.createBiquadFilter()
		filter.type = "lowpass"
		filter.frequency.setValueAtTime(
			Math.min(settings.cutoff, context.sampleRate / 2),
			context.currentTime
		)
		// Low-pass Q is in dB, and anything above the flat response peaks above unity gain.
		// Resonance is added on top of flat and the loop gain is reduced by the peak it adds,
		// so the string always decays.
		const q = NON_RESONANT_Q + settings.resonance
		const linear = 10 ** (q / 20)
		const peak = linear <= Math.SQRT1_2 ? 1 : linear / Math.sqrt(1 - 1 / (4 * linear * linear))
		filter.Q.setValueAtTime(q, context.currentTime)
		feedback.gain.setValueAtTime(settings.feedback / peak, context.currentTime)
		excitation.connect(delay)
		delay.connect(filter)
		filter.connect(feedback)
		feedback.connect(delay)
		filter.connect(input)
		const tune = pitchControl(context, delay.delayTime)
		return {
			nodes: [delay, feedback, filter],
			sources: [excitation],
			pitch: (frequency) =>
				tune(
					Math.max(
						// A delay inside a feedback loop cannot be shorter than one render block,
						// so notes above about 375 Hz at 48 kHz all sound at that pitch.
						128 / context.sampleRate,
						Math.min(2, 1 / (frequency * 2 ** (settings.detune / 1200)))
					)
				)
		}
	}
}