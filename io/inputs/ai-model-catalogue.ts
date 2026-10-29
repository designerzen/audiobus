import { AI_IMPROV, AI_MELODY, AI_DRUMS, AI_MUSIC_VAE, AI_TRIO } from "./input-types"
import type { DeviceAttribution } from "../device-classification"

export type AIInputId =
	| typeof AI_IMPROV
	| typeof AI_MELODY
	| typeof AI_DRUMS
	| typeof AI_MUSIC_VAE
	| typeof AI_TRIO

export interface AIModelDefinition {
	id: string
	name: string
	description: string
	engine: "rnn" | "vae"
	checkpoint: string
	sizeMB: number
	steps: number
	drums?: boolean
	trio?: boolean
	chords?: boolean
	attribution: DeviceAttribution
}

export const MAGENTA_ATTRIBUTION: DeviceAttribution = {
	author: "The Magenta Team / Google",
	sourceUrl: "https://github.com/magenta/magenta-js",
	license: "Apache-2.0 (Magenta.js)",
	licenseUrls: ["https://github.com/magenta/magenta-js/blob/master/LICENSE"]
}
export const AI_MODEL_INDEX_URL =
	"https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md"
const ROOT = "https://storage.googleapis.com/magentadata/js/checkpoints"

/** URLs and approximate weight sizes from Magenta's published checkpoint index. */
export const AI_MODELS: Record<string, AIModelDefinition> = {
	[AI_IMPROV]: {
		id: AI_IMPROV,
		name: "Improv RNN",
		description: "Improvise a melody over your chord progression from a short MIDI primer.",
		engine: "rnn",
		checkpoint: `${ROOT}/music_rnn/chord_pitches_improv`,
		sizeMB: 5.6,
		steps: 64,
		chords: true,
		attribution: MAGENTA_ATTRIBUTION
	},
	[AI_MELODY]: {
		id: AI_MELODY,
		name: "Melody RNN",
		description: "Continue a short melody using Magenta’s recurrent neural network.",
		engine: "rnn",
		checkpoint: `${ROOT}/music_rnn/basic_rnn`,
		sizeMB: 13,
		steps: 64,
		attribution: MAGENTA_ATTRIBUTION
	},
	[AI_DRUMS]: {
		id: AI_DRUMS,
		name: "Drums RNN",
		description: "Continue a General MIDI drum primer into a new rhythmic pattern.",
		engine: "rnn",
		checkpoint: `${ROOT}/music_rnn/drum_kit_rnn`,
		sizeMB: 11.9,
		steps: 64,
		drums: true,
		attribution: MAGENTA_ATTRIBUTION
	},
	[AI_MUSIC_VAE]: {
		id: AI_MUSIC_VAE,
		name: "MusicVAE Melody",
		description: "Sample a fresh two-bar melody without writing a primer.",
		engine: "vae",
		checkpoint: `${ROOT}/music_vae/mel_2bar_small`,
		sizeMB: 17.7,
		steps: 32,
		attribution: MAGENTA_ATTRIBUTION
	},
	[AI_TRIO]: {
		id: AI_TRIO,
		name: "MusicVAE Trio",
		description: "Generate four bars of melody, bass and drums on MIDI channels 1, 2 and 10.",
		engine: "vae",
		checkpoint: `${ROOT}/music_vae/trio_4bar`,
		sizeMB: 17.6,
		steps: 64,
		trio: true,
		attribution: MAGENTA_ATTRIBUTION
	}
}