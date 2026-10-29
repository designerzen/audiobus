export const SYNTH_303_PARAMETERS = {
	waveform: {
		label: "Waveform (0 saw, 1 square)",
		defaultValue: 0,
		minValue: 0,
		maxValue: 1,
		step: 1
	},
	cutoff: { label: "Cutoff (Hz)", defaultValue: 10000, minValue: 200, maxValue: 20000, step: 1 },
	resonance: { label: "Resonance", defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01 },
	envMod: {
		label: "Envelope modulation",
		defaultValue: 0.5,
		minValue: 0,
		maxValue: 1,
		step: 0.01
	},
	accent: { label: "Accent", defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01 },
	decay: { label: "Decay (ms)", defaultValue: 1000, minValue: 100, maxValue: 2000, step: 1 },
	tuning: {
		label: "Tuning (semitones)",
		defaultValue: 0,
		minValue: -12,
		maxValue: 12,
		step: 0.01
	},
	shape: { label: "Foldback shape", defaultValue: 0.5, minValue: 0, maxValue: 1, step: 0.01 },
	threshold: {
		label: "Distortion amount",
		defaultValue: 0.5,
		minValue: 0,
		maxValue: 1,
		step: 0.01
	},
	delaySend: { label: "Delay send", defaultValue: 0, minValue: 0, maxValue: 1, step: 0.01 },
	delayFeedback: {
		label: "Delay feedback",
		defaultValue: 0,
		minValue: 0,
		maxValue: 0.85,
		step: 0.01
	},
	delayTime: {
		label: "Delay time (seconds)",
		defaultValue: 0.45,
		minValue: 0.01,
		maxValue: 2,
		step: 0.01
	},
	volume: { label: "Volume", defaultValue: 0.35, minValue: 0, maxValue: 1, step: 0.01 }
} as const
export type Synth303Settings = Record<keyof typeof SYNTH_303_PARAMETERS, number>