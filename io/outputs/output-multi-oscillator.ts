import PhotoSynthOutput, {
	commonParameters,
	pitchControl,
	numeric,
	waveform,
	setWaveform,
	noiseBuffer,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph,
	type Waveform
} from "../../instruments/photosynth/output-base.ts"

export interface MultiOscillatorSettings extends CommonSettings {
	oscillators: number
	shape: Waveform
	shape2: Waveform
	shape3: Waveform
	amplitude: number
	detune: number
	spread: number
	octave3: number
	filterCutOff: number
	filterResonance: number
	filterOverdrive: number
	filterAttack: number
	filterDecay: number
	filterSustain: number
	filterRelease: number
	noise: number
	delayTime: number
	delayMix: number
	delayFeedback: number
}
export type MultiOscillatorOptions = OutputOptions<MultiOscillatorSettings>
const parameters: Parameters<MultiOscillatorSettings> = {
	...commonParameters,
	oscillators: numeric(2, 1, 3, 1),
	shape: waveform("sine"),
	shape2: waveform("sine"),
	shape3: waveform("sine"),
	amplitude: numeric(0.7, 0, 1),
	detune: numeric(0, -1200, 1200, 1),
	spread: numeric(0, 0, 100, 1),
	octave3: numeric(-1, -2, 2, 1),
	filterCutOff: numeric(2200, 20, 20000, 1),
	filterResonance: numeric(1.8, 0, 30),
	filterOverdrive: numeric(2.5, 0.1, 8),
	filterAttack: numeric(0.002, 0.001, 10, 0.001),
	filterDecay: numeric(0.08, 0.001, 10, 0.001),
	filterSustain: numeric(0, 0, 1),
	filterRelease: numeric(0.1, 0.005, 20, 0.001),
	noise: numeric(0, 0, 1),
	delayTime: numeric(0.5, 0.001, 2, 0.001),
	delayMix: numeric(0, 0, 1),
	delayFeedback: numeric(0.25, 0, 0.95)
}

export default class OutputMultiOscillator extends PhotoSynthOutput<MultiOscillatorSettings> {
	readonly name = "Multi Oscillator"
	readonly description =
		"One to three detuned oscillators with envelopes, filtered noise and delay"
	constructor(options: MultiOscillatorOptions) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { context, settings } = this
		const now = context.currentTime
		const filter = context.createBiquadFilter()
		filter.type = "lowpass"
		filter.Q.setValueAtTime(settings.filterResonance, now)
		const cutoff = Math.min(settings.filterCutOff, context.sampleRate / 2)
		const peak = Math.min(cutoff * settings.filterOverdrive, context.sampleRate / 2)
		filter.frequency.setValueAtTime(cutoff, now)
		filter.frequency.linearRampToValueAtTime(peak, now + settings.filterAttack)
		filter.frequency.linearRampToValueAtTime(
			cutoff + (peak - cutoff) * settings.filterSustain,
			now + settings.filterAttack + settings.filterDecay
		)
		const mix = context.createGain()
		mix.gain.setValueAtTime(settings.amplitude / settings.oscillators, now)
		mix.connect(filter)
		filter.connect(input)
		const nodes: AudioNode[] = [mix, filter]
		const sources: AudioScheduledSourceNode[] = []
		const tuners: ((value: number) => void)[] = []
		const shapes = [settings.shape, settings.shape2, settings.shape3]
		for (let index = 0; index < settings.oscillators; index++) {
			const oscillator = context.createOscillator()
			setWaveform(context, oscillator, shapes[index])
			const spread = settings.oscillators === 1 ? 0 : (index === 0 ? -1 : 1) * settings.spread
			oscillator.detune.setValueAtTime(settings.detune + spread, now)
			oscillator.connect(mix)
			tuners.push(pitchControl(context, oscillator.frequency))
			sources.push(oscillator)
		}
		if (settings.noise > 0) {
			const noise = context.createBufferSource()
			noise.buffer = noiseBuffer(context, 1)
			noise.loop = true
			const level = context.createGain()
			level.gain.setValueAtTime(settings.noise, now)
			noise.connect(level)
			level.connect(filter)
			nodes.push(level)
			sources.push(noise)
		}
		if (settings.delayMix > 0) {
			const delay = context.createDelay(2)
			const wet = context.createGain()
			const feedback = context.createGain()
			delay.delayTime.setValueAtTime(settings.delayTime, now)
			wet.gain.setValueAtTime(settings.delayMix, now)
			feedback.gain.setValueAtTime(settings.delayFeedback, now)
			filter.connect(delay)
			delay.connect(wet)
			wet.connect(input)
			delay.connect(feedback)
			feedback.connect(delay)
			nodes.push(delay, wet, feedback)
		}
		return {
			nodes,
			sources,
			pitch: (frequency) => {
				for (const [index, tune] of tuners.entries()) {
					tune(frequency * (index === 2 ? 2 ** settings.octave3 : 1))
				}
			},
			release: (endAt) => {
				filter.frequency.cancelAndHoldAtTime(context.currentTime)
				filter.frequency.linearRampToValueAtTime(
					cutoff,
					Math.min(endAt, context.currentTime + settings.filterRelease)
				)
			}
		}
	}
}