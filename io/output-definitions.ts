/**
 * Output Definitions
 *
 * Central registry of output device metadata including:
 * - Display names and descriptions
 * - Icon paths for visual representation
 * - Categories and classifications
 *
 * This provides a single source of truth for output UI presentation
 */

import * as OUTPUT_TYPES from "./outputs/output-types.ts"

export interface OutputDefinition {
	id: string
	name: string
	description: string
	icon: string
	category: string
}

export const OUTPUT_DEFINITIONS: Record<string, OutputDefinition> = {
	[OUTPUT_TYPES.CONSOLE]: {
		id: OUTPUT_TYPES.CONSOLE,
		name: "Console",
		description: "Logs MIDI events to browser console (dev mode only)",
		icon: "/icons/output-console.svg",
		category: "Debug",
	},

	[OUTPUT_TYPES.PINK_TROMBONE]: {
		id: OUTPUT_TYPES.PINK_TROMBONE,
		name: "Pink Trombone",
		description: "Vocal synthesis engine with speech-like sounds",
		icon: "/icons/output-pink-trombone.svg",
		category: "Synthesis",
	},

	[OUTPUT_TYPES.NOTATION]: {
		id: OUTPUT_TYPES.NOTATION,
		name: "Notation",
		description: "Displays notes on a musical staff",
		icon: "/icons/output-notation.svg",
		category: "Visual",
	},

	[OUTPUT_TYPES.SPECTRUM_ANALYSER]: {
		id: OUTPUT_TYPES.SPECTRUM_ANALYSER,
		name: "Spectrum Analyser",
		description: "Visualizes audio spectrum using FFT analysis with realtime waveform display",
		icon: "/icons/output-spectrum-analyser.svg",
		category: "Visualizer",
	},

	[OUTPUT_TYPES.SPEECH_SYNTHESIS]: {
		id: OUTPUT_TYPES.SPEECH_SYNTHESIS,
		name: "Speech Synthesis",
		description: "Uses the Web Speech Synthesis API to sing note names",
		icon: "/icons/output-speech-synthesis.svg",
		category: "Audio",
	},

	[OUTPUT_TYPES.VIBRATOR]: {
		id: OUTPUT_TYPES.VIBRATOR,
		name: "Vibrator",
		description: "Triggers device vibration when a note within a range is played",
		icon: "/icons/output-vibrator.svg",
		category: "Haptic",
	},

	[OUTPUT_TYPES.WAM2]: {
		id: OUTPUT_TYPES.WAM2,
		name: "WAM2",
		description: "Manages the WAM2 Audio Engine",
		icon: "/icons/output-wam2.svg",
		category: "Audio",
	},

	[OUTPUT_TYPES.WEBMIDI]: {
		id: OUTPUT_TYPES.WEBMIDI,
		name: "WebMIDI Device",
		description: "Sends MIDI messages to a connected WebMIDI device",
		icon: "/icons/output-webmidi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.NATIVE_MIDI]: {
		id: OUTPUT_TYPES.NATIVE_MIDI,
		name: "Native MIDI Device",
		description: "Sends MIDI messages to a connected native OS MIDI device (Windows/macOS/Linux)",
		icon: "/icons/output-native-midi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.BLE_MIDI]: {
		id: OUTPUT_TYPES.BLE_MIDI,
		name: "BLE MIDI",
		description: "BLE MIDI",
		icon: "/icons/output-ble-midi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.MIDI2]: {
		id: OUTPUT_TYPES.MIDI2,
		name: "MIDI 2.0",
		description: "MIDI 2.0 device output",
		icon: "/icons/output-midi2.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.MIDI2_NATIVE]: {
		id: OUTPUT_TYPES.MIDI2_NATIVE,
		name: "MIDI 2.0 Native",
		description: "MIDI 2.0 output with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		icon: "/icons/output-midi2-native.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.SUPERSONIC]: {
		id: OUTPUT_TYPES.SUPERSONIC,
		name: "Supersonic",
		description: "SuperCollider-based sound synthesis engine",
		icon: "/icons/output-supersonic.svg",
		category: "Synthesis",
	},

	[OUTPUT_TYPES.METRONOME]: {
		id: OUTPUT_TYPES.METRONOME,
		name: "Metronome",
		description: "Produces audible clicks in response to MIDI clock signals",
		icon: "/icons/output-metronome.svg",
		category: "Utility",
	},

	[OUTPUT_TYPES.AUDIO_CLICK]: {
		id: OUTPUT_TYPES.AUDIO_CLICK,
		name: "Audio Click",
		description: "Plays audio click sounds from a selected asset library on every bar",
		icon: "/icons/output-audio-click.svg",
		category: "Utility",
	},
}

/**
 * Get output definition by ID
 */
export function getOutputDefinition(id: string): OutputDefinition | undefined {
	return OUTPUT_DEFINITIONS[id]
}

/**
 * Get icon path for an output
 */
export function getOutputIcon(id: string): string {
	return OUTPUT_DEFINITIONS[id]?.icon || "/icons/output-default.svg"
}

/**
 * Get all outputs grouped by category
 */
export function getOutputsByCategory(): Record<string, OutputDefinition[]> {
	const grouped: Record<string, OutputDefinition[]> = {}

	Object.values(OUTPUT_DEFINITIONS).forEach((def) => {
		if (!grouped[def.category]) {
			grouped[def.category] = []
		}
		grouped[def.category].push(def)
	})

	return grouped
}
