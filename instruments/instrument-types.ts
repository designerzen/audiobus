/**
 * Instrument Type Constants
 */
export const INSTRUMENT_TYPE_SYNTH_OSCILLATOR = "synth-oscillator"
export const INSTRUMENT_TYPE_TONE_SYNTH = "tone-synth"
export const INSTRUMENT_TYPE_TONE_MONO_SYNTH = "tone-mono-synth"
export const INSTRUMENT_TYPE_TONE_FM_SYNTH = "tone-fm-synth"
export const INSTRUMENT_TYPE_TONE_PLUCK_STRING = "tone-pluck-string"
export const INSTRUMENT_TYPE_TONE_SAMPLER = "tone-sampler"
export const INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT = "scsynth-instrument"

/**
 * Instrument Category Constants
 */
export const INSTRUMENT_CATEGORY_OSCILLATOR = "oscillator"
export const INSTRUMENT_CATEGORY_SYNTHESIS = "synthesis"
export const INSTRUMENT_CATEGORY_FM = "fm"
export const INSTRUMENT_CATEGORY_PHYSICAL = "physical"
export const INSTRUMENT_CATEGORY_SAMPLING = "sampling"
export const INSTRUMENT_CATEGORY_SUPERCOLLIDER = "supercollider"

/**
 * External Data Key Constants
 */
export const EXTERNAL_DATA_KEY_SCSYNTH = "scsynth"
export const EXTERNAL_DATA_KEY_SAMPLE_URLS = "sampleUrls"

/**
 * Instrument metadata for lazy loading
 */
export interface InstrumentMetadata {
	id: string
	name: string
	description: string
	category: "oscillator" | "synthesis" | "sampling" | "physical" | "fm" | "supercollider"
	loader: () => Promise<any>
	requiresExternalData?: string[] // e.g., ["scsynth", "sampleUrls"]
}

/**
 * All available instruments registry
 */
export const INSTRUMENTS: Map<string, InstrumentMetadata> = new Map([
	[
		INSTRUMENT_TYPE_SYNTH_OSCILLATOR,
		{
			id: INSTRUMENT_TYPE_SYNTH_OSCILLATOR,
			name: "Synth Oscillator",
			description: "Customizable oscillator with ADSR envelope and filter",
			category: INSTRUMENT_CATEGORY_OSCILLATOR,
			loader: () => import("./oscillators/synth-oscillator.ts")
		}
	],
	[
		INSTRUMENT_TYPE_TONE_SYNTH,
		{
			id: INSTRUMENT_TYPE_TONE_SYNTH,
			name: "Tone Synth",
			description: "Polyphonic synthesizer using Tone.js",
			category: INSTRUMENT_CATEGORY_SYNTHESIS,
			loader: () => import("./tone/tone-synth.ts")
		}
	],
	[
		INSTRUMENT_TYPE_TONE_MONO_SYNTH,
		{
			id: INSTRUMENT_TYPE_TONE_MONO_SYNTH,
			name: "Tone Mono Synth",
			description: "Monophonic synthesizer with portamento using Tone.js",
			category: INSTRUMENT_CATEGORY_SYNTHESIS,
			loader: () => import("./tone/tone-mono-synth.ts")
		}
	],
	[
		INSTRUMENT_TYPE_TONE_FM_SYNTH,
		{
			id: INSTRUMENT_TYPE_TONE_FM_SYNTH,
			name: "Tone FM Synth",
			description: "Frequency modulation synthesizer using Tone.js",
			category: INSTRUMENT_CATEGORY_FM,
			loader: () => import("./tone/tone-fm-synth.ts")
		}
	],
	[
		INSTRUMENT_TYPE_TONE_PLUCK_STRING,
		{
			id: INSTRUMENT_TYPE_TONE_PLUCK_STRING,
			name: "Tone Pluck String",
			description: "Plucked string synthesizer using Karplus-Strong algorithm",
			category: INSTRUMENT_CATEGORY_PHYSICAL,
			loader: () => import("./tone/tone-pluck-string.ts")
		}
	],
	[
		INSTRUMENT_TYPE_TONE_SAMPLER,
		{
			id: INSTRUMENT_TYPE_TONE_SAMPLER,
			name: "Tone Sampler",
			description: "Sample-based synthesizer with pitch shifting",
			category: INSTRUMENT_CATEGORY_SAMPLING,
			loader: () => import("./tone/tone-sampler.ts"),
			requiresExternalData: [EXTERNAL_DATA_KEY_SAMPLE_URLS]
		}
	],
	[
		INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
		{
			id: INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
			name: "SuperCollider Synth",
			description: "SuperCollider synthesizer via scsynth",
			category: INSTRUMENT_CATEGORY_SUPERCOLLIDER,
			loader: () => import("./super-collider/scsynth-instrument.ts"),
			requiresExternalData: [EXTERNAL_DATA_KEY_SCSYNTH]
		}
	]
])
