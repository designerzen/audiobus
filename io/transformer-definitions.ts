import type { DeviceClassification } from "./device-classification.ts"
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

export interface TransformerDefinition extends DeviceClassification<"transformer"> {
	id: string
	name: string
	description: string
	icon: string
	category: string
}

export const TRANSFORMER_DEFINITIONS: Record<string, TransformerDefinition> = {
	[TRANSFORMER_TYPE.ID_PITCH_MIRROR]: {
		id: TRANSFORMER_TYPE.ID_PITCH_MIRROR,
		name: "Pitch Mirror",
		description: "Invert melodic intervals around a chosen centre note.",
		icon: "/icons/transformer-pitch-mirror.svg",
		category: "Pitch",
		type: "transformer",
		subtype: "pitch"
	},
	[TRANSFORMER_TYPE.ID_INTERVAL_STACK]: {
		id: TRANSFORMER_TYPE.ID_INTERVAL_STACK,
		name: "Interval Stack",
		description: "Build parallel harmonies from up to eight custom semitone offsets.",
		icon: "/icons/transformer-interval-stack.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},
	[TRANSFORMER_TYPE.ID_NOTE_BOUNCER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_BOUNCER,
		name: "Note Bouncer",
		description: "Generate progressively faster, softer note bounces with a finite ending.",
		icon: "/icons/transformer-note-bouncer.svg",
		category: "Pattern",
		type: "transformer",
		subtype: "pattern"
	},
	[TRANSFORMER_TYPE.ID_RELEASE_TRIGGER]: {
		id: TRANSFORMER_TYPE.ID_RELEASE_TRIGGER,
		name: "Release Trigger",
		description: "Play a short note when a key is released, with optional attack passthrough.",
		icon: "/icons/transformer-release-trigger.svg",
		category: "Duration",
		type: "transformer",
		subtype: "duration"
	},
	[TRANSFORMER_TYPE.ID_POLYPHONY_LIMITER]: {
		id: TRANSFORMER_TYPE.ID_POLYPHONY_LIMITER,
		name: "Polyphony Limiter",
		description: "Restrict simultaneous notes with selectable voice-stealing priorities.",
		icon: "/icons/transformer-polyphony-limiter.svg",
		category: "Range",
		type: "transformer",
		subtype: "range"
	},
	[TRANSFORMER_TYPE.ID_NOTE_ROUTER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_ROUTER,
		name: "Note Router",
		description: "Split notes between two MIDI channels by key or velocity.",
		icon: "/icons/transformer-note-router.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},
	[TRANSFORMER_TYPE.ID_CHANNEL_ALLOCATOR]: {
		id: TRANSFORMER_TYPE.ID_CHANNEL_ALLOCATOR,
		name: "Channel Allocator",
		description: "Spread polyphony across a pool of MIDI channels, with one note per channel.",
		icon: "/icons/transformer-channel-allocator.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},
	[TRANSFORMER_TYPE.ID_CC_STEPPER]: {
		id: TRANSFORMER_TYPE.ID_CC_STEPPER,
		name: "CC Stepper",
		description:
			"Quantise controller values and optionally coalesce updates onto a rhythmic grid.",
		icon: "/icons/transformer-cc-stepper.svg",
		category: "Modulation",
		type: "transformer",
		subtype: "modulation"
	},
	[TRANSFORMER_TYPE.ID_BROWSER_AI]: {
		id: TRANSFORMER_TYPE.ID_BROWSER_AI,
		name: "Browser AI Harmony",
		description:
			"Describe harmonies, generate a local note map with built-in browser AI, then play it live.",
		icon: "/icons/input-prompt-ai.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},
	[TRANSFORMER_TYPE.ID_VELOCITY_SHAPER]: {
		id: TRANSFORMER_TYPE.ID_VELOCITY_SHAPER,
		name: "Velocity Shaper",
		description: "Shape dynamics with velocity curves, limits, fixed levels and variation.",
		icon: "/icons/transformer-velocity-shaper.svg",
		category: "Variation",
		type: "transformer",
		subtype: "variation"
	},
	[TRANSFORMER_TYPE.ID_STRUMMER]: {
		id: TRANSFORMER_TYPE.ID_STRUMMER,
		name: "Strummer",
		description: "Spread live chords into upstrokes, downstrokes or alternating strokes.",
		icon: "/icons/transformer-strummer.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},
	[TRANSFORMER_TYPE.ID_PROBABILITY_GATE]: {
		id: TRANSFORMER_TYPE.ID_PROBABILITY_GATE,
		name: "Probability Gate",
		description: "Thin selected notes with seeded probability and safe note releases.",
		icon: "/icons/transformer-probability-gate.svg",
		category: "Variation",
		type: "transformer",
		subtype: "variation"
	},
	[TRANSFORMER_TYPE.ID_NOTE_MAPPER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_MAPPER,
		name: "Note Mapper",
		description: "Remap drum notes, layer pitches or turn keys into controller messages.",
		icon: "/icons/transformer-note-mapper.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},
	[TRANSFORMER_TYPE.ID_LATCH]: {
		id: TRANSFORMER_TYPE.ID_LATCH,
		name: "Latch / Hold",
		description: "Sustain chords after key release, replacing or toggling held notes.",
		icon: "/icons/transformer-latch.svg",
		category: "Duration",
		type: "transformer",
		subtype: "duration"
	},
	[TRANSFORMER_TYPE.ID_EUCLIDEAN_GATE]: {
		id: TRANSFORMER_TYPE.ID_EUCLIDEAN_GATE,
		name: "Euclidean Gate",
		description: "Pulse held notes with evenly spaced rhythms, rotation and accents.",
		icon: "/icons/transformer-euclidean-gate.svg",
		category: "Pattern",
		type: "transformer",
		subtype: "pattern"
	},
	[TRANSFORMER_TYPE.ID_VOICE_LEADER]: {
		id: TRANSFORMER_TYPE.ID_VOICE_LEADER,
		name: "Voice Leader",
		description: "Choose chord octave placements that minimise movement between voices.",
		icon: "/icons/transformer-voice-leader.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},
	[TRANSFORMER_TYPE.ID_CC_ANIMATOR]: {
		id: TRANSFORMER_TYPE.ID_CC_ANIMATOR,
		name: "CC Animator",
		description: "Animate a MIDI controller with tempo-synced waveforms while notes are held.",
		icon: "/icons/transformer-cc-animator.svg",
		category: "Modulation",
		type: "transformer",
		subtype: "modulation"
	},
	[TRANSFORMER_TYPE.ID_ORNAMENTER]: {
		id: TRANSFORMER_TYPE.ID_ORNAMENTER,
		name: "Ornamenter",
		description: "Decorate live notes with grace notes, flams, mordents and trills.",
		icon: "/icons/transformer-ornamenter.svg",
		category: "Pattern",
		type: "transformer",
		subtype: "pattern"
	},
	[TRANSFORMER_TYPE.ID_PHRASE_RECOMBINER]: {
		id: TRANSFORMER_TYPE.ID_PHRASE_RECOMBINER,
		name: "Phrase Recombiner",
		description: "Capture a phrase, then rotate, mirror or shuffle its note properties.",
		icon: "/icons/transformer-phrase-recombiner.svg",
		category: "Variation",
		type: "transformer",
		subtype: "variation"
	},
	[TRANSFORMER_TYPE.ID_LEGATO]: {
		id: TRANSFORMER_TYPE.ID_LEGATO,
		name: "Legato",
		description:
			"Connect a melody until the next note, with adjustable overlap and maximum hold.",
		icon: "/icons/transformer-legato.svg",
		category: "Duration",
		type: "transformer",
		subtype: "duration"
	},
	[TRANSFORMER_TYPE.ID_CC_MAPPER]: {
		id: TRANSFORMER_TYPE.ID_CC_MAPPER,
		name: "CC Mapper",
		description: "Reassign, scale, invert, duplicate or filter MIDI controller messages.",
		icon: "/icons/transformer-cc-mapper.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},
	identity: {
		id: "identity",
		name: "Identity",
		description: "Passes notes through unchanged",
		icon: "/icons/transformer-default.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},
	Swinger: {
		id: "Swinger",
		name: "Swinger",
		description: "Adds swing to a groove",
		icon: "/icons/transformer-timing-humaniser.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},
	"kill-old": {
		id: "kill-old",
		name: "Kill Old Transformer",
		description: "Removes stale and everlasting notes",
		icon: "/icons/transformer-note-shortener.svg",
		category: "Duration",
		type: "transformer",
		subtype: "duration"
	},
	[TRANSFORMER_TYPE.ID_MAGENTA]: {
		id: TRANSFORMER_TYPE.ID_MAGENTA,
		name: "Magenta Melody",
		description: "Adds AI-generated melodies conditioned on your playing and harmony",
		icon: "/icons/transformer-magenta.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},
	[TRANSFORMER_TYPE.ID_ARPEGGIATOR]: {
		id: TRANSFORMER_TYPE.ID_ARPEGGIATOR,
		name: "Arpeggiator",
		description: "Breaks chords into flowing sequences of individual notes",
		icon: "/icons/transformer-arpeggiator.svg",
		category: "Pattern",
		type: "transformer",
		subtype: "pattern"
	},

	[TRANSFORMER_TYPE.ID_QUANTISE]: {
		id: TRANSFORMER_TYPE.ID_QUANTISE,
		name: "Quantise",
		description: "Snaps notes to a grid for rhythmic precision",
		icon: "/icons/transformer-quantise.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},

	[TRANSFORMER_TYPE.ID_HARMONISER]: {
		id: TRANSFORMER_TYPE.ID_HARMONISER,
		name: "Harmoniser",
		description: "Adds harmonic voices above the input note",
		icon: "/icons/transformer-harmoniser.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},

	[TRANSFORMER_TYPE.ID_CHORDIFIER]: {
		id: TRANSFORMER_TYPE.ID_CHORDIFIER,
		name: "Chordifier",
		description: "Expands single notes into harmonic chords",
		icon: "/icons/transformer-chordifier.svg",
		category: "Harmony",
		type: "transformer",
		subtype: "harmony"
	},

	[TRANSFORMER_TYPE.ID_NOTE_SHORTENER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_SHORTENER,
		name: "Note Shortener",
		description: "Reduces the duration of notes for staccato effects",
		icon: "/icons/transformer-note-shortener.svg",
		category: "Duration",
		type: "transformer",
		subtype: "duration"
	},

	[TRANSFORMER_TYPE.ID_NOTE_REPEATER]: {
		id: TRANSFORMER_TYPE.ID_NOTE_REPEATER,
		name: "Note Repeater",
		description: "Repeats notes multiple times for rhythmic textures",
		icon: "/icons/transformer-note-repeater.svg",
		category: "Pattern",
		type: "transformer",
		subtype: "pattern"
	},

	[TRANSFORMER_TYPE.ID_NOTE_REVERB]: {
		id: TRANSFORMER_TYPE.ID_NOTE_REVERB,
		name: "Note Reverb",
		description: "Repeats notes at intervals with progressively lower velocities",
		icon: "/icons/transformer-note-repeater.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},

	[TRANSFORMER_TYPE.ID_RANDOMISER]: {
		id: TRANSFORMER_TYPE.ID_RANDOMISER,
		name: "Randomiser",
		description: "Adds controlled randomness to note parameters",
		icon: "/icons/transformer-randomiser.svg",
		category: "Variation",
		type: "transformer",
		subtype: "variation"
	},

	[TRANSFORMER_TYPE.ID_NOTE_DELAY]: {
		id: TRANSFORMER_TYPE.ID_NOTE_DELAY,
		name: "Note Delay",
		description: "Delays notes by a specified duration",
		icon: "/icons/transformer-note-delay.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},

	[TRANSFORMER_TYPE.ID_TRANSPOSER]: {
		id: TRANSFORMER_TYPE.ID_TRANSPOSER,
		name: "Transposer",
		description: "Shifts notes up or down by a specified interval",
		icon: "/icons/transformer-transposer.svg",
		category: "Pitch",
		type: "transformer",
		subtype: "pitch"
	},

	[TRANSFORMER_TYPE.ID_MICROTONALITY]: {
		id: TRANSFORMER_TYPE.ID_MICROTONALITY,
		name: "Microtonality",
		description: "Divides musical intervals into microtonal subdivisions",
		icon: "/icons/transformer-microtonality.svg",
		category: "Pitch",
		type: "transformer",
		subtype: "pitch"
	},

	[TRANSFORMER_TYPE.ID_CHANNELER]: {
		id: TRANSFORMER_TYPE.ID_CHANNELER,
		name: "Channeler",
		description: "Routes notes to specific MIDI channels",
		icon: "/icons/transformer-channeler.svg",
		category: "Routing",
		type: "transformer",
		subtype: "routing"
	},

	[TRANSFORMER_TYPE.ID_CONSTRICTOR]: {
		id: TRANSFORMER_TYPE.ID_CONSTRICTOR,
		name: "Constrictor",
		description: "Limits notes to a specified range",
		icon: "/icons/transformer-constrictor.svg",
		category: "Range",
		type: "transformer",
		subtype: "range"
	},

	[TRANSFORMER_TYPE.ID_TIMING_HUMANISER]: {
		id: TRANSFORMER_TYPE.ID_TIMING_HUMANISER,
		name: "Timing Humaniser",
		description: "Adds humanlike timing variations to notes",
		icon: "/icons/transformer-timing-humaniser.svg",
		category: "Timing",
		type: "transformer",
		subtype: "timing"
	},

	[TRANSFORMER_TYPE.ID_VIBRATOR]: {
		id: TRANSFORMER_TYPE.ID_VIBRATOR,
		name: "Vibrato",
		description: "Adds vibrato by gently varying note pitch up and down",
		icon: "/icons/transformer-vibrator.svg",
		category: "Modulation",
		type: "transformer",
		subtype: "modulation"
	},

	[TRANSFORMER_TYPE.ID_FILTER]: {
		id: TRANSFORMER_TYPE.ID_FILTER,
		name: "Filter",
		description: "Selectively passes or blocks notes based on criteria",
		icon: "/icons/transformer-filter.svg",
		category: "Range",
		type: "transformer",
		subtype: "range"
	},

	[TRANSFORMER_TYPE.ID_EMOJI]: {
		id: TRANSFORMER_TYPE.ID_EMOJI,
		name: "Emoji",
		description: "Transforms notes based on emoji input patterns",
		icon: "/icons/transformer-emoji.svg",
		category: "Variation",
		type: "transformer",
		subtype: "variation"
	},

	[TRANSFORMER_TYPE.ID_MIDI_FILE_PLAYER]: {
		id: TRANSFORMER_TYPE.ID_MIDI_FILE_PLAYER,
		name: "MIDI File Player",
		description: "Plays notes from loaded MIDI files",
		icon: "/icons/transformer-midi-file-player.svg",
		category: "Input",
		type: "transformer",
		subtype: "input"
	}
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