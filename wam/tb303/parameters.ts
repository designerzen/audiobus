export const TB303_ID = "org.harmoneasy.tb303"
export const TB303_URL = "harmoneasy:tb303"
export const TB303_PARAMETERS = {
	tuning: { label: "Tuning", defaultValue: 0, minValue: -700, maxValue: 700, units: "cents" },
	cutoff: { label: "Cutoff Freq", defaultValue: 450, minValue: 60, maxValue: 5000, units: "Hz" },
	resonance: { label: "Resonance", defaultValue: 0.65, minValue: 0, maxValue: 1 },
	envMod: { label: "Env Mod", defaultValue: 0.55, minValue: 0, maxValue: 1 },
	decay: { label: "Decay", defaultValue: 0.5, minValue: 0.2, maxValue: 2.5, units: "s" },
	accent: { label: "Accent", defaultValue: 0.65, minValue: 0, maxValue: 1 },
	waveform: {
		label: "Waveform",
		type: "choice",
		defaultValue: 0,
		minValue: 0,
		maxValue: 1,
		choices: ["Saw", "Square"]
	},
	shape: { label: "Foldback Shape", defaultValue: 0.5, minValue: 0, maxValue: 1 },
	threshold: { label: "Distortion", defaultValue: 0.5, minValue: 0, maxValue: 1 },
	delaySend: { label: "Delay Send", defaultValue: 0, minValue: 0, maxValue: 1 },
	delayFeedback: { label: "Delay Feedback", defaultValue: 0, minValue: 0, maxValue: 0.85 },
	delayTime: { label: "Delay Time", defaultValue: 0.45, minValue: 0.01, maxValue: 2, units: "s" },
	volume: { label: "Volume", defaultValue: 0.65, minValue: 0, maxValue: 1 }
}
export const TB303_DESCRIPTOR = {
	identifier: TB303_ID,
	name: "TB-303",
	vendor: "Harmoneasy",
	description:
		"Original 303 wavetable bass synthesizer with tied-note slide, accents, foldback distortion and delay",
	version: "1.1.0",
	apiVersion: "2.0.0",
	keywords: ["303", "acid", "bass", "monophonic"],
	category: ["Instrument"],
	path: TB303_URL,
	isInstrument: true,
	hasAudioInput: false,
	hasAudioOutput: true,
	hasMidiInput: true,
	hasMidiOutput: false
}