import type { EffectChoice, EffectDefinition } from "./effect-interface"

const WAVEFORMS: readonly EffectChoice[] = [
	{ value: "sine", label: "Sine" },
	{ value: "triangle", label: "Triangle" },
	{ value: "square", label: "Square" },
	{ value: "sawtooth", label: "Sawtooth" }
]

const rate = (initial: number, max = 10) => ({
	id: "rate",
	name: "Rate",
	initial,
	min: 0.05,
	max,
	step: 0.05,
	unit: "Hz"
})
const waveform = { id: "waveform", name: "Waveform", initial: "sine", choices: WAVEFORMS }
const frequency = (id: string, name: string, initial: number, min = 20, max = 20000) => ({
	id,
	name,
	initial,
	min,
	max,
	step: 1,
	unit: "Hz"
})
const decibels = (id: string, name: string, initial: number, min = -24, max = 24) => ({
	id,
	name,
	initial,
	min,
	max,
	step: 0.5,
	unit: "dB"
})
const milliseconds = (id: string, name: string, initial: number, min: number, max: number) => ({
	id,
	name,
	initial,
	min,
	max,
	step: 0.1,
	unit: "ms"
})
const amount = (id: string, name: string, initial: number, min = 0, max = 1) => ({
	id,
	name,
	initial,
	min,
	max,
	step: 0.01
})

export const DELAY: EffectDefinition = {
	id: "delay",
	name: "Delay",
	description: "Echoes that repeat and darken with each pass",
	mix: 0.35,
	parameters: [
		{ id: "time", name: "Time", initial: 0.35, min: 0.01, max: 2, step: 0.01, unit: "s" },
		amount("feedback", "Feedback", 0.4, 0, 0.95),
		frequency("tone", "Tone", 6000, 200)
	]
}

export const PING_PONG_DELAY: EffectDefinition = {
	id: "ping-pong-delay",
	name: "Ping-Pong Delay",
	description: "Echoes that bounce between the left and right speakers",
	mix: 0.35,
	parameters: [
		{ id: "time", name: "Time", initial: 0.3, min: 0.01, max: 2, step: 0.01, unit: "s" },
		amount("feedback", "Feedback", 0.45, 0, 0.95),
		frequency("tone", "Tone", 6000, 200)
	]
}

export const REVERB: EffectDefinition = {
	id: "reverb",
	name: "Reverb",
	description: "Algorithmic room reverb with adjustable size, pre-delay and brightness",
	mix: 0.3,
	parameters: [
		{ id: "decay", name: "Decay", initial: 2.5, min: 0.1, max: 10, step: 0.1, unit: "s" },
		milliseconds("preDelay", "Pre-delay", 20, 0, 250),
		frequency("brightness", "Brightness", 8000, 500)
	]
}

export const IMPULSE_RESPONSE: EffectDefinition = {
	id: "impulse-response",
	name: "Impulse Response",
	description: "Convolution filter for reverbs, spaces and speaker cabinets",
	mix: 0.5,
	parameters: []
}

export const FILTER: EffectDefinition = {
	id: "filter",
	name: "Filter",
	description: "Low-pass, high-pass, band-pass, notch, shelf and peaking filters",
	mix: false,
	parameters: [
		{
			id: "filterType",
			name: "Type",
			initial: "lowpass",
			choices: [
				{ value: "lowpass", label: "Low-pass" },
				{ value: "highpass", label: "High-pass" },
				{ value: "bandpass", label: "Band-pass" },
				{ value: "notch", label: "Notch" },
				{ value: "lowshelf", label: "Low shelf" },
				{ value: "highshelf", label: "High shelf" },
				{ value: "peaking", label: "Peaking" },
				{ value: "allpass", label: "All-pass" }
			]
		},
		frequency("frequency", "Frequency", 1000),
		{ id: "q", name: "Resonance (Q)", initial: 1, min: 0.1, max: 30, step: 0.1 },
		decibels("gain", "Gain", 0, -40, 40)
	]
}

export const AUTO_FILTER: EffectDefinition = {
	id: "auto-filter",
	name: "Auto Filter",
	description: "A resonant filter swept by an LFO for wah and wobble effects",
	mix: 1,
	parameters: [
		{
			id: "filterType",
			name: "Type",
			initial: "lowpass",
			choices: [
				{ value: "lowpass", label: "Low-pass" },
				{ value: "bandpass", label: "Band-pass" },
				{ value: "highpass", label: "High-pass" }
			]
		},
		frequency("frequency", "Frequency", 600),
		{ id: "q", name: "Resonance (Q)", initial: 6, min: 0.1, max: 30, step: 0.1 },
		rate(1, 20),
		{ id: "depth", name: "Depth", initial: 2, min: 0, max: 6, step: 0.1, unit: "octaves" },
		waveform
	]
}

export const EQ: EffectDefinition = {
	id: "eq",
	name: "Three-Band EQ",
	description: "Low shelf, sweepable mid and high shelf equaliser",
	mix: false,
	parameters: [
		decibels("lowGain", "Low gain", 0),
		frequency("lowFrequency", "Low frequency", 200, 20, 1000),
		decibels("midGain", "Mid gain", 0),
		frequency("midFrequency", "Mid frequency", 1000, 200, 8000),
		{ id: "midQ", name: "Mid width (Q)", initial: 0.8, min: 0.1, max: 10, step: 0.1 },
		decibels("highGain", "High gain", 0),
		frequency("highFrequency", "High frequency", 4000, 1000)
	]
}

export const COMPRESSOR: EffectDefinition = {
	id: "compressor",
	name: "Compressor",
	description: "Evens out dynamics",
	// The compressor's look-ahead delays its output, so blending in dry audio would comb-filter.
	mix: false,
	parameters: [
		decibels("threshold", "Threshold", -24, -100, 0),
		{ id: "ratio", name: "Ratio", initial: 4, min: 1, max: 20, step: 0.1, unit: ":1" },
		decibels("knee", "Knee", 30, 0, 40),
		{ id: "attack", name: "Attack", initial: 0.003, min: 0, max: 1, step: 0.001, unit: "s" },
		{ id: "release", name: "Release", initial: 0.25, min: 0, max: 1, step: 0.01, unit: "s" },
		decibels("makeup", "Makeup gain", 0, 0, 24)
	]
}

export const LIMITER: EffectDefinition = {
	id: "limiter",
	name: "Limiter",
	description: "Compresses peaks above a threshold and clips anything left above the ceiling",
	mix: false,
	parameters: [
		decibels("threshold", "Threshold", -3, -30, 0),
		{ id: "release", name: "Release", initial: 0.1, min: 0.01, max: 1, step: 0.01, unit: "s" },
		decibels("ceiling", "Ceiling", -0.5, -24, 0)
	]
}

export const DISTORTION: EffectDefinition = {
	id: "distortion",
	name: "Distortion",
	description: "Overdrive, hard clipping, fuzz and wave folding",
	mix: 1,
	parameters: [
		{
			id: "curve",
			name: "Character",
			initial: "soft",
			choices: [
				{ value: "soft", label: "Overdrive (soft clip)" },
				{ value: "hard", label: "Distortion (hard clip)" },
				{ value: "fuzz", label: "Fuzz (asymmetric)" },
				{ value: "fold", label: "Wave folder" }
			]
		},
		{ id: "drive", name: "Drive", initial: 20, min: 0, max: 100, step: 1 },
		frequency("tone", "Tone", 5000, 200),
		decibels("level", "Level", -6, -36, 12)
	]
}

export const BITCRUSHER: EffectDefinition = {
	id: "bitcrusher",
	name: "Bitcrusher",
	description: "Reduces bit depth for lo-fi digital grit",
	mix: 1,
	parameters: [
		{ id: "bits", name: "Bit depth", initial: 6, min: 1, max: 16, step: 1, unit: "bits" },
		frequency("tone", "Tone", 20000, 200)
	]
}

export const CHORUS: EffectDefinition = {
	id: "chorus",
	name: "Chorus",
	description: "Stereo detuned voices that thicken and widen the sound",
	mix: 0.5,
	parameters: [
		rate(0.8, 5),
		milliseconds("depth", "Depth", 3, 0, 15),
		milliseconds("delay", "Delay", 20, 1, 50)
	]
}

export const FLANGER: EffectDefinition = {
	id: "flanger",
	name: "Flanger",
	description: "A swept comb filter for jet-plane whooshes",
	mix: 0.5,
	parameters: [
		rate(0.25, 5),
		milliseconds("depth", "Depth", 2, 0, 10),
		milliseconds("delay", "Delay", 3, 0.5, 15),
		amount("feedback", "Feedback", 0.6, -0.95, 0.95)
	]
}

export const PHASER: EffectDefinition = {
	id: "phaser",
	name: "Phaser",
	description: "Six all-pass stages swept by an LFO for a swirling sound",
	mix: 0.5,
	parameters: [
		rate(0.5),
		{ id: "depth", name: "Depth", initial: 2.5, min: 0, max: 5, step: 0.1, unit: "octaves" },
		frequency("frequency", "Centre frequency", 800, 100, 5000),
		amount("feedback", "Feedback", 0.4, 0, 0.9)
	]
}

export const TREMOLO: EffectDefinition = {
	id: "tremolo",
	name: "Tremolo",
	description: "Rhythmic volume modulation",
	mix: false,
	parameters: [rate(5, 20), amount("depth", "Depth", 0.5), waveform]
}

export const AUTO_PAN: EffectDefinition = {
	id: "auto-pan",
	name: "Auto Pan",
	description: "Moves the sound between the left and right speakers",
	mix: false,
	parameters: [rate(0.5), amount("depth", "Depth", 1), waveform]
}

export const VIBRATO: EffectDefinition = {
	id: "vibrato",
	name: "Vibrato",
	description: "Pitch wobble from a modulated delay",
	mix: false,
	parameters: [rate(5, 14), milliseconds("depth", "Depth", 2, 0, 10), waveform]
}

export const RING_MODULATOR: EffectDefinition = {
	id: "ring-modulator",
	name: "Ring Modulator",
	description: "Multiplies the sound by a carrier for metallic, bell-like tones",
	mix: 1,
	parameters: [frequency("frequency", "Carrier", 440, 1, 5000), waveform]
}

export const STEREO_WIDTH: EffectDefinition = {
	id: "stereo-width",
	name: "Stereo Width",
	description: "Narrows to mono or widens the stereo image",
	mix: false,
	parameters: [amount("width", "Width", 1.5, 0, 2)]
}

export const UTILITY: EffectDefinition = {
	id: "utility",
	name: "Utility",
	description: "Gain, pan and polarity",
	mix: false,
	parameters: [
		decibels("gain", "Gain", 0, -60, 24),
		amount("pan", "Pan", 0, -1, 1),
		{
			id: "polarity",
			name: "Polarity",
			initial: "normal",
			choices: [
				{ value: "normal", label: "Normal" },
				{ value: "inverted", label: "Inverted" }
			]
		}
	]
}

/** Low-pass and high-pass Q, in dB, with no resonant peak above unity gain. */
export const NON_RESONANT_Q = -3.0103

export const dbToGain = (decibels: number) => Math.pow(10, decibels / 20)