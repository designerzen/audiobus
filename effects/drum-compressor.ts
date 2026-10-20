export interface DrumCompressorSettings {
	compressorEnabled: boolean
	compressorThreshold: number
	compressorRatio: number
	compressorKnee: number
	compressorAttack: number
	compressorRelease: number
	compressorMakeupGain: number
}

/** Attack and release use audio seconds; makeup gain and threshold use dB. */
export const DRUM_COMPRESSOR_PARAMETERS = {
	compressorThreshold: {
		name: 'Threshold',
		min: -100,
		max: 0,
		step: 1,
		initial: -18,
		unit: 'dB',
		scale: 1,
	},
	compressorRatio: {
		name: 'Ratio',
		min: 1,
		max: 20,
		step: 0.1,
		initial: 4,
		unit: ':1',
		scale: 1,
	},
	compressorKnee: { name: 'Knee', min: 0, max: 40, step: 1, initial: 12, unit: 'dB', scale: 1 },
	compressorAttack: {
		name: 'Attack',
		min: 0,
		max: 1,
		step: 0.001,
		initial: 0.01,
		unit: 'ms',
		scale: 1000,
	},
	compressorRelease: {
		name: 'Release',
		min: 0.001,
		max: 1,
		step: 0.001,
		initial: 0.15,
		unit: 'ms',
		scale: 1000,
	},
	compressorMakeupGain: {
		name: 'Makeup gain',
		min: 0,
		max: 24,
		step: 0.1,
		initial: 0,
		unit: 'dB',
		scale: 1,
	},
} as const

export const DEFAULT_DRUM_COMPRESSOR_SETTINGS: Readonly<DrumCompressorSettings> = {
	compressorEnabled: true,
	compressorThreshold: DRUM_COMPRESSOR_PARAMETERS.compressorThreshold.initial,
	compressorRatio: DRUM_COMPRESSOR_PARAMETERS.compressorRatio.initial,
	compressorKnee: DRUM_COMPRESSOR_PARAMETERS.compressorKnee.initial,
	compressorAttack: DRUM_COMPRESSOR_PARAMETERS.compressorAttack.initial,
	compressorRelease: DRUM_COMPRESSOR_PARAMETERS.compressorRelease.initial,
	compressorMakeupGain: DRUM_COMPRESSOR_PARAMETERS.compressorMakeupGain.initial,
}