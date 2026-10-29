export const MOOG_ID = "org.harmoneasy.moog"
export const MOOG_URL = "harmoneasy:moog"
export const MOOG_PARAMETERS = {
	frequency: { label: "Cutoff", defaultValue: 1200, minValue: 20, maxValue: 20000, units: "Hz" },
	gain: { label: "Resonance", defaultValue: 2, minValue: 0, maxValue: 4 },
	waveform: {
		label: "Osc 1 waveform",
		type: "choice",
		defaultValue: 0,
		minValue: 0,
		maxValue: 3,
		choices: ["Saw", "Square", "Triangle", "Sine"]
	},
	attack: { label: "Amp attack", defaultValue: 0.01, minValue: 0.001, maxValue: 2, units: "s" },
	release: { label: "Amp release", defaultValue: 0.2, minValue: 0.005, maxValue: 4, units: "s" },
	volume: { label: "Volume", defaultValue: 0.3, minValue: 0, maxValue: 1 },
	decay: { label: "Amp decay", defaultValue: 0.15, minValue: 0.001, maxValue: 4, units: "s" },
	sustain: { label: "Amp sustain", defaultValue: 1, minValue: 0, maxValue: 1 },
	filterAttack: {
		label: "Filter attack",
		defaultValue: 0.01,
		minValue: 0.001,
		maxValue: 4,
		units: "s"
	},
	filterDecay: {
		label: "Filter decay",
		defaultValue: 0.25,
		minValue: 0.001,
		maxValue: 4,
		units: "s"
	},
	filterSustain: { label: "Filter sustain", defaultValue: 0, minValue: 0, maxValue: 1 },
	filterRelease: {
		label: "Filter release",
		defaultValue: 0.2,
		minValue: 0.005,
		maxValue: 4,
		units: "s"
	},
	filterAmount: {
		label: "Envelope amount",
		defaultValue: 0,
		minValue: -6,
		maxValue: 6,
		units: "oct"
	},
	keyTracking: { label: "Keyboard tracking", defaultValue: 0, minValue: 0, maxValue: 1 },
	octave: {
		label: "Osc 1 octave",
		type: "choice",
		defaultValue: 2,
		minValue: 0,
		maxValue: 4,
		choices: ["−2", "−1", "0", "+1", "+2"]
	},
	waveform2: {
		label: "Osc 2 waveform",
		type: "choice",
		defaultValue: 0,
		minValue: 0,
		maxValue: 3,
		choices: ["Saw", "Square", "Triangle", "Sine"]
	},
	octave2: {
		label: "Osc 2 octave",
		type: "choice",
		defaultValue: 2,
		minValue: 0,
		maxValue: 4,
		choices: ["−2", "−1", "0", "+1", "+2"]
	},
	detune: { label: "Osc 2 detune", defaultValue: 7, minValue: -50, maxValue: 50, units: "cents" },
	oscillatorMix: { label: "Osc 2 mix", defaultValue: 0, minValue: 0, maxValue: 1 },
	noise: { label: "Noise level", defaultValue: 0, minValue: 0, maxValue: 1 },
	sub: { label: "Sub level", defaultValue: 0, minValue: 0, maxValue: 1 },
	lfoRate: { label: "LFO rate", defaultValue: 5, minValue: 0.05, maxValue: 20, units: "Hz" },
	lfoWaveform: {
		label: "LFO waveform",
		type: "choice",
		defaultValue: 0,
		minValue: 0,
		maxValue: 2,
		choices: ["Sine", "Triangle", "Square"]
	},
	lfoPitch: { label: "Pitch depth", defaultValue: 0, minValue: 0, maxValue: 2, units: "st" },
	lfoFilter: { label: "Cutoff depth", defaultValue: 0, minValue: 0, maxValue: 4, units: "oct" },
	lfoAmp: { label: "Volume depth", defaultValue: 0, minValue: 0, maxValue: 1 },
	glide: { label: "Glide time", defaultValue: 0, minValue: 0, maxValue: 2, units: "s" },
	voiceMode: {
		label: "Voice mode",
		type: "choice",
		defaultValue: 0,
		minValue: 0,
		maxValue: 2,
		choices: ["Polyphonic", "Mono retrigger", "Mono legato"]
	}
}
export const MOOG_CONTROL_GROUPS = {
	Oscillators: [
		"waveform",
		"octave",
		"waveform2",
		"octave2",
		"detune",
		"oscillatorMix",
		"sub",
		"noise"
	],
	Filter: ["frequency", "gain", "keyTracking"],
	"Filter envelope": [
		"filterAttack",
		"filterDecay",
		"filterSustain",
		"filterRelease",
		"filterAmount"
	],
	"Amplitude envelope": ["attack", "decay", "sustain", "release", "volume"],
	Modulation: ["lfoRate", "lfoWaveform", "lfoPitch", "lfoFilter", "lfoAmp"],
	Performance: ["voiceMode", "glide"]
} satisfies Record<string, (keyof typeof MOOG_PARAMETERS)[]>
export const MOOG_DESCRIPTOR = {
	identifier: MOOG_ID,
	name: "Moog",
	vendor: "Harmoneasy",
	description: "Polyphonic synthesizer with the Photosynth MoogFF ladder filter",
	version: "1.0.0",
	apiVersion: "2.0.0",
	keywords: ["moog", "ladder", "synthesizer"],
	category: ["Instrument"],
	path: MOOG_URL,
	isInstrument: true,
	hasAudioInput: false,
	hasAudioOutput: true,
	hasMidiInput: true,
	hasMidiOutput: false
}