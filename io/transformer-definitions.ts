/**
 * Transformer Definitions
 * 
 * Central registry of transformer metadata including:
 * - Display names and descriptions
 * - Icon paths for visual representation
 * - Categories and classifications
 * 
 * This provides a single source of truth for transformer UI presentation
 */

import { TRANSFORMER_TYPE } from "./transformer-factory"

export interface TransformerDefinition {
	id: string
	name: string
	description: string
	icon: string
	category: string
}

export const TRANSFORMER_DEFINITIONS: Record<string, TransformerDefinition> = {
	[TRANSFORMER_TYPE.ID_ARPEGGIATOR]: {
		id: TRANSFORMER_TYPE.ID_ARPEGGIATOR,
		name: "Arpeggiator",
		description: "Breaks chords into flowing sequences of individual notes",
		icon: "/icons/transformer-arpeggiator.svg",
		category: "Pattern",
	},

	[TRANSFORMER_TYPE.ID_QUANTISE]: {
		id: TRANSFORMER_TYPE.ID_QUANTISE,
		name: "Quantise",
		description: "Snaps notes to a grid for rhythmic precision",
		icon: "/icons/transformer-quantise.svg",
		category: "Timing",
	},

	[TRANSFORMER_TYPE.ID_HARMONISER]: {
		id: TRANSFORMER_TYPE.ID_HARMONISER,
		name: "Harmoniser",
		description: "Adds harmonic voices above the input note",
		icon: "/icons/transformer-harmoniser.svg",
		category: "Harmony",
	},

	[TRANSFORMER_TYPE.ID_CHORDIFIER]: {
		id: TRANSFORMER_TYPE.ID_CHORDIFIER,
		name: "Chordifier",
		description: "Expands single notes into harmonic chords",
		icon: "/icons/transformer-chordifier.svg",
		category: "Harmony",
	},

	[TRANSFORMER_TYPE.ID_NOTE_SHORTENER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_SHORTENER,
		name: "Note Shortener",
		description: "Reduces the duration of notes for staccato effects",
		icon: "/icons/transformer-note-shortener.svg",
		category: "Duration",
	},

	[TRANSFORMER_TYPE.ID_NOTE_REPEATER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_REPEATER,
		name: "Note Repeater",
		description: "Repeats notes multiple times for rhythmic textures",
		icon: "/icons/transformer-note-repeater.svg",
		category: "Pattern",
	},

	[TRANSFORMER_TYPE.ID_RANDOMISER]: {
		id: TRANSFORMER_TYPE.ID_RANDOMISER,
		name: "Randomiser",
		description: "Adds controlled randomness to note parameters",
		icon: "/icons/transformer-randomiser.svg",
		category: "Variation",
	},

	[TRANSFORMER_TYPE.ID_NOTE_DELAY]: {
		id: TRANSFORMER_TYPE.ID_NOTE_DELAY,
		name: "Note Delay",
		description: "Delays notes by a specified duration",
		icon: "/icons/transformer-note-delay.svg",
		category: "Timing",
	},

	[TRANSFORMER_TYPE.ID_TRANSPOSER]: {
		id: TRANSFORMER_TYPE.ID_TRANSPOSER,
		name: "Transposer",
		description: "Shifts notes up or down by a specified interval",
		icon: "/icons/transformer-transposer.svg",
		category: "Pitch",
	},

	[TRANSFORMER_TYPE.ID_MICROTONALITY]: {
		id: TRANSFORMER_TYPE.ID_MICROTONALITY,
		name: "Microtonality",
		description: "Divides musical intervals into microtonal subdivisions",
		icon: "/icons/transformer-microtonality.svg",
		category: "Pitch",
	},

	[TRANSFORMER_TYPE.ID_CHANNELER]: {
		id: TRANSFORMER_TYPE.ID_CHANNELER,
		name: "Channeler",
		description: "Routes notes to specific MIDI channels",
		icon: "/icons/transformer-channeler.svg",
		category: "Routing",
	},

	[TRANSFORMER_TYPE.ID_CONSTRICTOR]: {
		id: TRANSFORMER_TYPE.ID_CONSTRICTOR,
		name: "Constrictor",
		description: "Limits notes to a specified range",
		icon: "/icons/transformer-constrictor.svg",
		category: "Range",
	},

	[TRANSFORMER_TYPE.ID_TIMING_HUMANISER]: {
		id: TRANSFORMER_TYPE.ID_TIMING_HUMANISER,
		name: "Timing Humaniser",
		description: "Adds humanlike timing variations to notes",
		icon: "/icons/transformer-timing-humaniser.svg",
		category: "Timing",
	},

	[TRANSFORMER_TYPE.ID_VIBRATOR]: {
		id: TRANSFORMER_TYPE.ID_VIBRATOR,
		name: "Vibrator",
		description: "Adds vibrato modulation to note pitch",
		icon: "/icons/transformer-vibrator.svg",
		category: "Modulation",
	},

	[TRANSFORMER_TYPE.ID_FILTER]: {
		id: TRANSFORMER_TYPE.ID_FILTER,
		name: "Filter",
		description: "Selectively passes or blocks notes based on criteria",
		icon: "/icons/transformer-filter.svg",
		category: "Range",
	},

	[TRANSFORMER_TYPE.ID_EMOJI]: {
		id: TRANSFORMER_TYPE.ID_EMOJI,
		name: "Emoji",
		description: "Transforms notes based on emoji input patterns",
		icon: "/icons/transformer-emoji.svg",
		category: "Variation",
	},

	[TRANSFORMER_TYPE.ID_MIDI_FILE_PLAYER]: {
		id: TRANSFORMER_TYPE.ID_MIDI_FILE_PLAYER,
		name: "MIDI File Player",
		description: "Plays notes from loaded MIDI files",
		icon: "/icons/transformer-midi-file-player.svg",
		category: "Input",
	},
}

/**
 * Get transformer definition by ID
 */
export function getTransformerDefinition(id: string): TransformerDefinition | undefined {
	return TRANSFORMER_DEFINITIONS[id]
}

/**
 * Get icon path for a transformer
 */
export function getTransformerIcon(id: string): string {
	return TRANSFORMER_DEFINITIONS[id]?.icon || "/icons/transformer-default.svg"
}

/**
 * Get all transformers grouped by category
 */
export function getTransformersByCategory(): Record<string, TransformerDefinition[]> {
	const grouped: Record<string, TransformerDefinition[]> = {}

	Object.values(TRANSFORMER_DEFINITIONS).forEach((def) => {
		if (!grouped[def.category]) {
			grouped[def.category] = []
		}
		grouped[def.category].push(def)
	})

	return grouped
}
