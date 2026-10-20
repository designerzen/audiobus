import type { DeviceClassification } from "./device-classification.ts"
/**
 * Input Definitions
 *
 * Central registry of input device metadata including:
 * - Display names and descriptions
 * - Icon paths for visual representation
 * - Categories and classifications
 *
 * This provides a single source of truth for input UI presentation
 */

import * as INPUT_TYPES from "./inputs/input-types.ts"
import { MIDI_DEVICE_PROFILES, onMidiDeviceProfilesChanged } from '../midi/hardware/device-profiles'

export interface InputDefinition extends DeviceClassification {
	id: string
	name: string
	description: string
	icon: string
	category: string
}

export const INPUT_DEFINITIONS: Record<string, InputDefinition> = {
    ...Object.fromEntries(Object.entries(MIDI_DEVICE_PROFILES).map(([id, profile]) => [id, {
        id, name: profile.name, description: profile.description,
        type: 'midi', subtype: 'device', category: 'MIDI', icon: profile.icon ?? '/icons/input-webmidi.svg'
    }])),
	[INPUT_TYPES.KEYBOARD]: {
		id: INPUT_TYPES.KEYBOARD,
		type: "controller",
		subtype: "keyboard",
		name: "Keyboard",
		description: "QWERTY keyboard input for playing notes",
		icon: "/icons/input-keyboard.svg",
		category: "Device",
	},

	[INPUT_TYPES.GAMEPAD]: {
		id: INPUT_TYPES.GAMEPAD,
		type: "controller",
		subtype: "gamepad",
		name: "Gamepad",
		description: "Game controller / joystick input",
		icon: "/icons/input-gamepad.svg",
		category: "Device",
	},

	[INPUT_TYPES.GAMEPAD_MUSIC]: {
		id: INPUT_TYPES.GAMEPAD_MUSIC,
		type: "controller",
		subtype: "gamepad",
		name: "Gamepad Music Controller",
		description: "Advanced gamepad input with multiple music modes: Chord, Melodic, Drum, Arpeggiator",
		icon: "/icons/input-gamepad-music.svg",
		category: "Device",
	},

	[INPUT_TYPES.WEBMIDI]: {
		id: INPUT_TYPES.WEBMIDI,
		type: "midi",
		subtype: "device",
		name: "WebMIDI Device",
		description: "MIDI input from external devices via WebMIDI API",
		icon: "/icons/input-webmidi.svg",
		category: "MIDI",
	},

	[INPUT_TYPES.NATIVE_MIDI]: {
		id: INPUT_TYPES.NATIVE_MIDI,
		type: "midi",
		subtype: "device",
		name: "Native MIDI Device",
		description: "MIDI input from external devices via native OS APIs (Windows/macOS/Linux)",
		icon: "/icons/input-native-midi.svg",
		category: "MIDI",
	},

	[INPUT_TYPES.MIDI2_NATIVE]: {
		id: INPUT_TYPES.MIDI2_NATIVE,
		type: "midi",
		subtype: "device",
		name: "MIDI 2.0 Native",
		description: "MIDI 2.0 input with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		icon: "/icons/input-midi2-native.svg",
		category: "MIDI",
	},

	[INPUT_TYPES.BLE_MIDI]: {
		id: INPUT_TYPES.BLE_MIDI,
		type: "midi",
		subtype: "device",
		name: "BLE MIDI",
		description: "Bluetooth MIDI input",
		icon: "/icons/input-ble-midi.svg",
		category: "MIDI",
	},

	[INPUT_TYPES.MICROPHONE_FORMANT]: {
		id: INPUT_TYPES.MICROPHONE_FORMANT,
		type: "audio",
		subtype: "formant",
		name: "Microphone Formant",
		description: "Microphone input for formant analysis",
		icon: "/icons/input-microphone-formant.svg",
		category: "Audio",
	},

	[INPUT_TYPES.LEAP_MOTION]: {
		id: INPUT_TYPES.LEAP_MOTION,
		type: "controller",
		subtype: "gesture",
		name: "Leap Motion",
		description: "Hand gesture tracking via Leap Motion device",
		icon: "/icons/input-leap-motion.svg",
		category: "Gesture",
	},

	[INPUT_TYPES.ONSCREEN_KEYBOARD]: {
		id: INPUT_TYPES.ONSCREEN_KEYBOARD,
		type: "controller",
		subtype: "keyboard",
		name: "Onscreen Keyboard",
		description: "Mouse-based virtual keyboard input",
		icon: "/icons/input-onscreen-keyboard.svg",
		category: "UI",
	},

	[INPUT_TYPES.PROMPT_AI]: {
		id: INPUT_TYPES.PROMPT_AI,
		type: "generator",
		subtype: "ai",
		name: "PromptAI Generator",
		description: "AI-powered prompt input for generating note sequences and combinations",
		icon: "/icons/input-prompt-ai.svg",
		category: "AI",
	},

	[INPUT_TYPES.PROMPT_AI_SPEECH]: {
		id: INPUT_TYPES.PROMPT_AI_SPEECH,
		type: "generator",
		subtype: "ai",
		name: "PromptAI Speech",
		description: "AI-powered input with speech recognition for generating note sequences via voice",
		icon: "/icons/input-prompt-ai-speech.svg",
		category: "AI",
	},

	[INPUT_TYPES.MIDI_TRANSPORT_CLOCK]: {
		id: INPUT_TYPES.MIDI_TRANSPORT_CLOCK,
		type: "sync",
		subtype: "clock",
		name: "MIDI Transport Clock",
		description: "MIDI transport clock input for timing synchronization (24 clocks per quarter note)",
		icon: "/icons/input-midi-transport-clock.svg",
		category: "Sync",
	},

	[INPUT_TYPES.MUSIC_MOUSE]: {
		id: INPUT_TYPES.MUSIC_MOUSE,
		type: "controller",
		subtype: "pointer",
		name: "Music Mouse",
		description: "Cursor-controlled musical instrument inspired by Laurie Spiegel's classic Music Mouse",
		icon: "/icons/input-music-mouse.svg",
		category: "UI",
	},

	[INPUT_TYPES.MICROPHONE_PITCH]: {
		id: INPUT_TYPES.MICROPHONE_PITCH,
		type: "audio",
		subtype: "pitch",
		name: "Microphone Pitch (ML)",
		description: "Polyphonic pitch detection from microphone using Spotify's Basic Pitch neural network",
		icon: "/icons/input-microphone-pitch.svg",
		category: "Audio",
	},
	[INPUT_TYPES.DVS_CONTROL_VINYL]: {
		id: INPUT_TYPES.DVS_CONTROL_VINYL,
		type: "sync",
		subtype: "vinyl",
		name: "DVS Control Vinyl",
		description: "Control vinyl clock input for relative playback speed",
		icon: "/icons/input-default.svg",
		category: "Sync",
	},
} satisfies Record<INPUT_TYPES.InputId, InputDefinition>
onMidiDeviceProfilesChanged(() => {
    for (const [id, profile] of Object.entries(MIDI_DEVICE_PROFILES)) INPUT_DEFINITIONS[id] = {
        id, name: profile.name, description: profile.description, type: 'midi', subtype: 'device', category: 'MIDI', icon: profile.icon ?? '/icons/input-webmidi.svg'
    }
})

/**
 * Get input definition by ID
 */
export function getInputDefinition(id: string): InputDefinition | undefined {
	return INPUT_DEFINITIONS[id]
}

/**
 * Get icon path for an input
 */
export function getInputIcon(id: string): string {
	return INPUT_DEFINITIONS[id]?.icon || "/icons/input-default.svg"
}

/**
 * Get all inputs grouped by category
 */
export function getInputsByCategory(): Record<string, InputDefinition[]> {
	const grouped: Record<string, InputDefinition[]> = {}

	Object.values(INPUT_DEFINITIONS).forEach((def) => {
		if (!grouped[def.category]) {
			grouped[def.category] = []
		}
		grouped[def.category].push(def)
	})

	return grouped
}
