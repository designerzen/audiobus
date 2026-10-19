import type { DeviceClassification, DeviceAttribution } from "./device-classification.ts"
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
import { CLAP_PATCHES } from '../instruments/clap/clap-catalog'
import { WAM2_INSTRUMENTS, wam2OutputId } from '../wam/registry'

export interface OutputDefinition extends DeviceClassification {
	id: string
	name: string
	description: string
	icon: string
	category: string
	title?: string
	attribution?: DeviceAttribution
}

export const OUTPUT_DEFINITIONS: Record<string, OutputDefinition> = {
	[OUTPUT_TYPES.MOOG]: {
		id: OUTPUT_TYPES.MOOG,
		type: "engine",
		subtype: "instrument",
		name: "Moog",
		description: "Photosynth MoogFF ladder synthesizer with MIDI and WAM2 controls",
		icon: "/icons/output-wam2.svg",
		category: "Synthesis",
	},
	...Object.fromEntries(CLAP_PATCHES.map(patch => [OUTPUT_TYPES.webclapOutputId(patch.id), {
		id: OUTPUT_TYPES.webclapOutputId(patch.id),
		type: patch.type ?? (patch.features?.includes('instrument') ? 'engine' : 'audio'),
		subtype: patch.subtype ?? (patch.features?.includes('instrument') ? 'instrument' : 'effect'),
		name: `WebCLAP: ${patch.name}`,
		title: patch.title,
		description: patch.description ?? `WebCLAP plugin by ${patch.author}`,
		attribution: patch.attribution,
		icon: '/icons/output-webclap.svg',
		category: patch.category ?? 'WebCLAP',
	} satisfies OutputDefinition])),
	...Object.fromEntries(WAM2_INSTRUMENTS.map(plugin => [wam2OutputId(plugin), {
		id: wam2OutputId(plugin), type: 'engine', subtype: 'instrument',
		name: `${plugin.name} (WAM2)`, description: plugin.description,
		icon: '/icons/output-wam2.svg', category: 'Audio',
	}])),
	[OUTPUT_TYPES.DESCRIBE]: {
		id: OUTPUT_TYPES.DESCRIBE,
		type: "visual",
		subtype: "description",
		name: "Describe",
		description: "Describes notes, chords, extensions and inversions in musical language",
		icon: "/icons/output-describe.svg",
		category: "Visual",
	},
	[OUTPUT_TYPES.CONSOLE]: {
		id: OUTPUT_TYPES.CONSOLE,
		type: "debug",
		subtype: "console",
		name: "Console",
		description: "Logs MIDI events to browser console (dev mode only)",
		icon: "/icons/output-console.svg",
		category: "Debug",
	},

	[OUTPUT_TYPES.PINK_TROMBONE]: {
		id: OUTPUT_TYPES.PINK_TROMBONE,
		type: "engine",
		subtype: "instrument",
		name: "Pink Trombone",
		description: "Vocal synthesis engine with speech-like sounds",
		icon: "/icons/output-pink-trombone.svg",
		category: "Synthesis",
	},

	[OUTPUT_TYPES.NOTATION]: {
		id: OUTPUT_TYPES.NOTATION,
		type: "visual",
		subtype: "notation",
		name: "Notation",
		description: "Displays notes on a musical staff",
		icon: "/icons/output-notation.svg",
		category: "Visual",
	},

	[OUTPUT_TYPES.SPECTRUM_ANALYSER]: {
		id: OUTPUT_TYPES.SPECTRUM_ANALYSER,
		type: "visual",
		subtype: "visualiser",
		name: "Spectrum Analyser",
		description: "Visualizes audio spectrum using FFT analysis with realtime waveform display",
		icon: "/icons/output-spectrum-analyser.svg",
		category: "Visualizer",
	},

	[OUTPUT_TYPES.SPEECH_SYNTHESIS]: {
		id: OUTPUT_TYPES.SPEECH_SYNTHESIS,
		type: "audio",
		subtype: "speech",
		name: "Speech Synthesis",
		description: "Uses the Web Speech Synthesis API to sing note names",
		icon: "/icons/output-speech-synthesis.svg",
		category: "Audio",
	},

	[OUTPUT_TYPES.VIBRATOR]: {
		id: OUTPUT_TYPES.VIBRATOR,
		type: "haptic",
		subtype: "vibration",
		name: "Vibrator",
		description: "Triggers device vibration when a note within a range is played",
		icon: "/icons/output-vibrator.svg",
		category: "Haptic",
	},

	[OUTPUT_TYPES.WAM2]: {
		id: OUTPUT_TYPES.WAM2,
		type: "engine",
		subtype: "instrument",
		name: "WAM2",
		description: "Manages the WAM2 Audio Engine",
		icon: "/icons/output-wam2.svg",
		category: "Audio",
	},
	[OUTPUT_TYPES.WAM]: {
		id: OUTPUT_TYPES.WAM,
		type: "engine",
		subtype: "instrument",
		name: "WAM",
		description: "Legacy Web Audio Modules: Yoshimi and webDX7",
		icon: "/icons/output-wam2.svg",
		category: "Audio",
	},

	[OUTPUT_TYPES.WEBMIDI]: {
		id: OUTPUT_TYPES.WEBMIDI,
		type: "midi",
		subtype: "device",
		name: "WebMIDI Device",
		description: "Sends MIDI messages to a connected WebMIDI device",
		icon: "/icons/output-webmidi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.NATIVE_MIDI]: {
		id: OUTPUT_TYPES.NATIVE_MIDI,
		type: "midi",
		subtype: "device",
		name: "Native MIDI Device",
		description: "Sends MIDI messages to a connected native OS MIDI device (Windows/macOS/Linux)",
		icon: "/icons/output-native-midi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.BLE_MIDI]: {
		id: OUTPUT_TYPES.BLE_MIDI,
		type: "midi",
		subtype: "device",
		name: "BLE MIDI",
		description: "BLE MIDI",
		icon: "/icons/output-ble-midi.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.MIDI2]: {
		id: OUTPUT_TYPES.MIDI2,
		type: "midi",
		subtype: "device",
		name: "MIDI 2.0",
		description: "MIDI 2.0 device output",
		icon: "/icons/output-midi2.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.MIDI2_NATIVE]: {
		id: OUTPUT_TYPES.MIDI2_NATIVE,
		type: "midi",
		subtype: "device",
		name: "MIDI 2.0 Native",
		description: "MIDI 2.0 output with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		icon: "/icons/output-midi2-native.svg",
		category: "MIDI",
	},

	[OUTPUT_TYPES.SUPERSONIC]: {
		id: OUTPUT_TYPES.SUPERSONIC,
		type: "engine",
		subtype: "instrument",
		name: "Supersonic",
		description: "SuperCollider-based sound synthesis engine",
		icon: "/icons/output-supersonic.svg",
		category: "Synthesis",
	},

	[OUTPUT_TYPES.METRONOME]: {
		id: OUTPUT_TYPES.METRONOME,
		type: "audio",
		subtype: "metronome",
		name: "Metronome",
		description: "Produces audible clicks in response to MIDI clock signals",
		icon: "/icons/output-metronome.svg",
		category: "Utility",
	},

	[OUTPUT_TYPES.AUDIO_CLICK]: {
		id: OUTPUT_TYPES.AUDIO_CLICK,
		type: "audio",
		subtype: "metronome",
		name: "Audio Click",
		description: "Plays audio click sounds from a selected asset library on every bar",
		icon: "/icons/output-audio-click.svg",
		category: "Utility",
	},
	[OUTPUT_TYPES.BUTTERCHURN]: {
		id: OUTPUT_TYPES.BUTTERCHURN,
		type: "visual",
		subtype: "visualiser",
		name: "Butterchurn",
		description: "WebGL music visualiser with animated patterns synced to audio",
		icon: "/icons/output-butterchurn.svg",
		category: "Visualizer",
	},
	[OUTPUT_TYPES.YOSHIMI]: {
		id: OUTPUT_TYPES.YOSHIMI,
		type: "engine",
		subtype: "instrument",
		name: "Yoshimi",
		description: "Software synthesizer with instrument presets",
		icon: "/icons/output-yoshimi.svg",
		category: "Synthesis",
	},
} satisfies Record<OUTPUT_TYPES.OutputId, OutputDefinition>

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
