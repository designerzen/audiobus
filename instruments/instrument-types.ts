import { INSTRUMENT_CLASSIFICATION, type DeviceClassification } from "../io/device-classification.ts"
import wam2Registry, { WAM2_INSTRUMENTS, wam2OutputId } from '../wam/registry'
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
export const INSTRUMENT_TYPE_CLAP = "clap"
export const INSTRUMENT_TYPE_FAUST = "faust"
export const INSTRUMENT_TYPE_OPENDAW_VAPORISATEUR = "opendaw-vaporisateur"
export const INSTRUMENT_TYPE_WAM2 = "wam2"

/**
 * Instrument Category Constants
 */
export const INSTRUMENT_CATEGORY_OSCILLATOR = "oscillator"
export const INSTRUMENT_CATEGORY_SYNTHESIS = "synthesis"
export const INSTRUMENT_CATEGORY_FM = "fm"
export const INSTRUMENT_CATEGORY_PHYSICAL = "physical"
export const INSTRUMENT_CATEGORY_SAMPLING = "sampling"
export const INSTRUMENT_CATEGORY_SUPERCOLLIDER = "supercollider"
export const INSTRUMENT_CATEGORY_FAUST = "faust"
export const INSTRUMENT_CATEGORY_WAM2 = "wam2"

/**
 * External Data Key Constants
 */
export const EXTERNAL_DATA_KEY_SCSYNTH = "scsynth"
export const EXTERNAL_DATA_KEY_SAMPLE_URLS = "sampleUrls"

/**
 * Instrument metadata for lazy loading
 */
export interface InstrumentMetadata extends DeviceClassification<'engine'> {
	id: string
	name: string
	description: string
	category: "oscillator" | "synthesis" | "sampling" | "physical" | "fm" | "supercollider" | "faust" | "wam2"
	loader: () => Promise<any>
	defaultOptions?: Record<string, any>
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
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
			...INSTRUMENT_CLASSIFICATION,
			name: "SuperCollider Synth",
			description: "SuperCollider synthesizer via scsynth",
			category: INSTRUMENT_CATEGORY_SUPERCOLLIDER,
			loader: () => import("./super-collider/scsynth-instrument.ts"),
			requiresExternalData: [EXTERNAL_DATA_KEY_SCSYNTH]
		}
	],
	[
		INSTRUMENT_TYPE_CLAP,
		{
			id: INSTRUMENT_TYPE_CLAP,
			...INSTRUMENT_CLASSIFICATION,
			name: "CLAP Instrument",
			description: "Web CLAP plugin synthesizer with automatic patch loading",
			category: "synthesis",
			loader: () => import("./clap/clap-instrument.ts")
		}
	],
	[
		INSTRUMENT_TYPE_FAUST,
		{
			id: INSTRUMENT_TYPE_FAUST,
			...INSTRUMENT_CLASSIFICATION,
			name: "FAUST Synthesizer",
			description: "Functional DSP synthesizer using FAUST compiled to WebAssembly",
			category: INSTRUMENT_CATEGORY_FAUST,
			loader: () => import("./faust/faust-instrument.ts")
		}
	],
	[
		INSTRUMENT_TYPE_OPENDAW_VAPORISATEUR,
		{
			id: INSTRUMENT_TYPE_OPENDAW_VAPORISATEUR,
			...INSTRUMENT_CLASSIFICATION,
			name: "openDAW Vaporisateur",
			description: "Vaporisateur instrument using openDAW framework",
			category: INSTRUMENT_CATEGORY_SYNTHESIS,
			loader: () => import("./openDAW/opendaw-vaporisateur.ts")
		}
	]
])

INSTRUMENTS.set(INSTRUMENT_TYPE_WAM2, {
	id: INSTRUMENT_TYPE_WAM2,
	...INSTRUMENT_CLASSIFICATION,
	name: 'WAM2 Instrument',
	description: 'Play Web Audio Module instruments with a searchable catalogue or a hosted plugin URL',
	category: INSTRUMENT_CATEGORY_WAM2,
	loader: () => import('./wam/wam-instrument'),
})

for (const plugin of WAM2_INSTRUMENTS) {
	const id = wam2OutputId(plugin)
	INSTRUMENTS.set(id, {
		id,
		...INSTRUMENT_CLASSIFICATION,
		name: `${plugin.name} (WAM2)`,
		description: `${plugin.description} — ${plugin.vendor}`,
		category: INSTRUMENT_CATEGORY_WAM2,
		defaultOptions: { pluginUrl: wam2Registry.getPluginUrl(plugin), name: plugin.name },
		loader: () => import('./wam/wam-instrument'),
	})
}
