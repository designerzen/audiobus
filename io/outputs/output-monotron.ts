import PhotoSynthOutput, {
	commonParameters,
	pitchControl,
	numeric,
	waveform,
	setWaveform,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph,
	type Waveform
} from "../../instruments/photosynth/output-base.ts"

export interface MonotronSettings extends CommonSettings {
	shape: Waveform
	lfoShape: Waveform
	detune: number
	cutoff: number
	resonance: number
	lfoRate: number
	lfoDepth: number
}
export type MonotronOptions = OutputOptions<MonotronSettings>
const parameters: Parameters<MonotronSettings> = {
	...commonParameters,
	decay: numeric(0.1, 0.001, 10, 0.001),
	sustain: numeric(1, 0, 1),
	release: numeric(0.01, 0.005, 20, 0.001),
	shape: waveform("sine"),
	lfoShape: waveform("sine"),
	detune: numeric(0, -1200, 1200, 1),
	cutoff: numeric(350, 20, 20000, 1),
	resonance: numeric(1, 0, 30),
	lfoRate: numeric(5, 0.01, 100, 0.01),
	lfoDepth: numeric(1, 0, 10000, 1)
}

export default class OutputMonotron extends PhotoSynthOutput<MonotronSettings> {
	readonly name = "Monotron"
	readonly description = "Polyphonic oscillator with a resonant low-pass filter and cutoff LFO"
	constructor(options: MonotronOptions) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { context, settings } = this
		const oscillator = context.createOscillator()
		const lfo = context.createOscillator()
		const depth = context.createGain()
		const filter = context.createBiquadFilter()
		setWaveform(context, oscillator, settings.shape)
		setWaveform(context, lfo, settings.lfoShape)
		oscillator.detune.setValueAtTime(settings.detune, context.currentTime)
		lfo.frequency.setValueAtTime(settings.lfoRate, context.currentTime)
		filter.type = "lowpass"
		filter.frequency.setValueAtTime(
			Math.min(settings.cutoff, context.sampleRate / 2),
			context.currentTime
		)
		filter.Q.setValueAtTime(settings.resonance, context.currentTime)
		oscillator.connect(filter)
		filter.connect(input)
		lfo.connect(depth)
		depth.connect(filter.frequency)
		return {
			nodes: [depth, filter],
			sources: [oscillator, lfo],
			pitch: pitchControl(context, oscillator.frequency),
			modulate: (value) =>
				depth.gain.setTargetAtTime(
					Math.min(settings.lfoDepth + value * 5000, context.sampleRate / 2),
					context.currentTime,
					0.005
				)
		}
	}
}