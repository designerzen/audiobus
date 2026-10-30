import { UI_INPUT_COMPONENTS } from "../ui/input-components.ts"
import { INPUT_DEFINITIONS } from "./input-definitions.ts"
import { browserAI } from "./browser-ai"
import { AI_MODELS } from "./inputs/ai-model-catalogue"
import type { DeviceClassification, DeviceAttribution } from "./device-classification.ts"
import { defineDevice } from "./device-definition"
import {
	MIDI_DEVICE_PROFILES,
	ensureMidiDeviceProfile,
	onMidiDeviceProfilesChanged
} from "../midi/hardware/device-profiles"
/**
 * Factory for creating audio input instances
 * Handles instantiation of available input types
 */
import * as INPUT_TYPES from "./inputs/input-types.ts"
import type { IAudioInput } from "./inputs/input-interface.ts"

export interface InputFactory extends DeviceClassification {
	attribution?: DeviceAttribution
	id: string
	name: string
	description: string
	isAvailable: () => boolean
	create: (options?: Record<string, any>) => IAudioInput | Promise<IAudioInput>
}

const loadSupportingLibrary = async (type: string) => {
	if (Object.hasOwn(AI_MODELS, type)) {
		return await import("./inputs/input-ai-music")
	}
	if (Object.hasOwn(UI_INPUT_COMPONENTS, type)) {
		return await import("./inputs/input-web-component.ts")
	}
	if (Object.hasOwn(MIDI_DEVICE_PROFILES, type)) {
		return await import("./inputs/input-profiled-midi-device")
	}
	// Create and return instance based on type
	switch (type) {
		case INPUT_TYPES.SCALE_EXPLORER:
			return await import("./inputs/input-scale-explorer")
		case INPUT_TYPES.STEP_SEQUENCER:
			return await import("./inputs/input-step-sequencer")
		case INPUT_TYPES.PADS:
			return await import("./inputs/input-pads")
		case INPUT_TYPES.MICROPHONE_TRIGGER:
			return await import("./inputs/input-microphone-trigger")
		case INPUT_TYPES.CAMERA_GESTURES:
			return await import("./inputs/input-camera-gestures")
		case INPUT_TYPES.EVENT_LOOP:
			return await import("./inputs/input-event-loop")
		case INPUT_TYPES.OSC:
			return await import("./inputs/input-osc")
		case INPUT_TYPES.MIDI_FILE:
			return await import("./inputs/input-midi-file")
		case INPUT_TYPES.KEYBOARD:
			return await import("./inputs/input-keyboard.ts")
		case INPUT_TYPES.GAMEPAD:
			return await import("./inputs/input-gamepad.ts")
		case INPUT_TYPES.GAMEPAD_MUSIC:
			return await import("./inputs/input-gamepad-music.ts")
		case INPUT_TYPES.WEBMIDI:
			return await import("./inputs/input-webmidi-device.ts")
		case INPUT_TYPES.NATIVE_MIDI:
			return await import("./inputs/input-native-midi-device.ts")
		case INPUT_TYPES.MIDI2_NATIVE:
			return await import("./inputs/input-midi2-native-device.ts")
		case INPUT_TYPES.BLE_MIDI:
			return await import("./inputs/input-ble-midi-device.ts")
		case INPUT_TYPES.MICROPHONE_FORMANT:
			return await import("./inputs/input-microphone-formant.ts")
		case INPUT_TYPES.LEAP_MOTION:
			return await import("./inputs/input-leap-motion.ts")
		case INPUT_TYPES.ONSCREEN_KEYBOARD:
			return await import("./inputs/input-onscreen-keyboard.ts")
		case INPUT_TYPES.PROMPT_AI:
			return await import("./inputs/input-prompt-ai.ts")
		case INPUT_TYPES.PROMPT_AI_SPEECH:
			return await import("./inputs/input-prompt-ai-speech.ts")
		case INPUT_TYPES.MIDI_TRANSPORT_CLOCK:
			return await import("./inputs/input-midi-transport-clock.ts")
		case INPUT_TYPES.MUSIC_MOUSE:
			return await import("./inputs/input-music-mouse.ts")
		case INPUT_TYPES.MICROPHONE_PITCH:
			return await import("./inputs/input-microphone-pitch.ts")
		case INPUT_TYPES.DVS_CONTROL_VINYL:
			return await import("./inputs/input-dvs-control-vinyl.ts")
		default:
			throw new Error(`Unknown input type: ${type}`)
	}
}

/**
 * Load and instantiate an input for a given type
 * Tracks loaded libraries for future optimization
 * @param type Input type identifier
 * @returns A new instance of the requested input type
 * @throws Error if the input type is unknown
 */
const loadedLibraries = new Map<string, any>()
const loadSupportingLibraries = async (type: string): Promise<any> => {
	if (loadedLibraries.has(type)) {
		return loadedLibraries.get(type)
	}

	// Mark library as loaded
	const libWrapper = await loadSupportingLibrary(type)
	const lib = libWrapper.default
	loadedLibraries.set(type, lib)
	return lib
}

/**
 * Create an input instance for a given type
 * @param type Input type identifier
 * @param options Optional configuration for the input
 * @returns A new instance of the requested input type
 */
const createInput = async (type: string, options = {}): Promise<IAudioInput> => {
	const Class = await loadSupportingLibraries(type)
	return new Class(
		Object.hasOwn(MIDI_DEVICE_PROFILES, type)
			? { ...options, profileId: type }
			: Object.hasOwn(AI_MODELS, type)
				? { ...options, modelId: type }
				: Object.hasOwn(UI_INPUT_COMPONENTS, type)
					? { ...options, component: type }
					: type === INPUT_TYPES.WEBMIDI
						? { autoConnect: true, ...options }
						: options
	)
}

/**
 * Available input factories
 * Add new inputs here as they become available
 * This lets us lazily load them as required
 * then uses the loaded imports in future requests
 */
export const INPUT_FACTORIES: InputFactory[] = [
	...Object.keys(AI_MODELS).map((id) => ({
		...INPUT_DEFINITIONS[id],
		isAvailable: () => typeof Worker !== "undefined",
		create: (options?: Record<string, any>) => createInput(id, options)
	})),
	...[
		INPUT_TYPES.SCALE_EXPLORER,
		INPUT_TYPES.STEP_SEQUENCER,
		INPUT_TYPES.PADS,
		INPUT_TYPES.EVENT_LOOP
	].map((id) => ({
		...INPUT_DEFINITIONS[id],
		isAvailable: () => true,
		create: (options?: Record<string, any>) => createInput(id, options)
	})),
	{
		...INPUT_DEFINITIONS[INPUT_TYPES.MICROPHONE_TRIGGER],
		isAvailable: () =>
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices?.getUserMedia &&
			typeof AudioContext !== "undefined",
		create: (options) => createInput(INPUT_TYPES.MICROPHONE_TRIGGER, options)
	},
	{
		...INPUT_DEFINITIONS[INPUT_TYPES.CAMERA_GESTURES],
		isAvailable: () =>
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices?.getUserMedia &&
			typeof Worker !== "undefined" &&
			typeof createImageBitmap === "function" &&
			typeof OffscreenCanvas !== "undefined",
		create: (options) => createInput(INPUT_TYPES.CAMERA_GESTURES, options)
	},
	{
		...INPUT_DEFINITIONS[INPUT_TYPES.OSC],
		isAvailable: () => typeof WebSocket !== "undefined",
		create: (options) => createInput(INPUT_TYPES.OSC, options)
	},
	...Object.keys(UI_INPUT_COMPONENTS).map(
		(id): InputFactory => ({
			...INPUT_DEFINITIONS[id],
			isAvailable: () =>
				typeof document !== "undefined" && typeof customElements !== "undefined",
			create: (options) => createInput(id, options)
		})
	),
	{
		...INPUT_DEFINITIONS[INPUT_TYPES.MIDI_FILE],
		isAvailable: () => true,
		create: (options) => createInput(INPUT_TYPES.MIDI_FILE, options)
	},
	...Object.entries(MIDI_DEVICE_PROFILES).map(
		([id, profile]): InputFactory => ({
			id,
			name: profile.name,
			description: profile.description,
			type: "midi",
			subtype: "device",
			isAvailable: () => typeof document !== "undefined",
			create: (options) => createInput(id, options)
		})
	),
	{
		id: INPUT_TYPES.KEYBOARD,
		type: INPUT_DEFINITIONS[INPUT_TYPES.KEYBOARD].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.KEYBOARD].subtype,
		name: "Keyboard",
		description: "QWERTY keyboard input for playing notes",
		isAvailable: () => true,
		create: (options) => createInput(INPUT_TYPES.KEYBOARD, options)
	},
	{
		id: INPUT_TYPES.GAMEPAD,
		type: INPUT_DEFINITIONS[INPUT_TYPES.GAMEPAD].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.GAMEPAD].subtype,
		name: "Gamepad",
		description: "Game controller / joystick input",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.getGamepads,
		create: (options) => createInput(INPUT_TYPES.GAMEPAD, options)
	},
	{
		id: INPUT_TYPES.GAMEPAD_MUSIC,
		type: INPUT_DEFINITIONS[INPUT_TYPES.GAMEPAD_MUSIC].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.GAMEPAD_MUSIC].subtype,
		name: "Gamepad Music Controller",
		description:
			"Advanced gamepad input with multiple music modes: Chord, Melodic, Drum, Arpeggiator",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.getGamepads,
		create: (options) => createInput(INPUT_TYPES.GAMEPAD_MUSIC, options)
	},
	{
		id: INPUT_TYPES.WEBMIDI,
		type: INPUT_DEFINITIONS[INPUT_TYPES.WEBMIDI].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.WEBMIDI].subtype,
		name: "WebMIDI Device",
		description: "MIDI input from external devices via WebMIDI API",
		isAvailable: () =>
			typeof navigator !== "undefined" && !!(navigator as any).requestMIDIAccess,
		create: (options) => createInput(INPUT_TYPES.WEBMIDI, options)
	},
	{
		id: INPUT_TYPES.NATIVE_MIDI,
		type: INPUT_DEFINITIONS[INPUT_TYPES.NATIVE_MIDI].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.NATIVE_MIDI].subtype,
		name: "Native MIDI Device",
		description: "MIDI input from external devices via native OS APIs (Windows/macOS/Linux)",
		isAvailable: () => true, // Native MIDI available on all platforms
		create: (options) => createInput(INPUT_TYPES.NATIVE_MIDI, options)
	},
	{
		id: INPUT_TYPES.MIDI2_NATIVE,
		type: INPUT_DEFINITIONS[INPUT_TYPES.MIDI2_NATIVE].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.MIDI2_NATIVE].subtype,
		name: "MIDI 2.0 Native",
		description:
			"MIDI 2.0 input with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		isAvailable: () => true, // Native MIDI available on all platforms
		create: (options) => createInput(INPUT_TYPES.MIDI2_NATIVE, options)
	},
	{
		id: INPUT_TYPES.BLE_MIDI,
		type: INPUT_DEFINITIONS[INPUT_TYPES.BLE_MIDI].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.BLE_MIDI].subtype,
		name: "BLE MIDI",
		description: "Bluetooth MIDI input",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.bluetooth,
		create: (options) => createInput(INPUT_TYPES.BLE_MIDI, options)
	},
	{
		id: INPUT_TYPES.MICROPHONE_FORMANT,
		type: INPUT_DEFINITIONS[INPUT_TYPES.MICROPHONE_FORMANT].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.MICROPHONE_FORMANT].subtype,
		name: "Microphone Formant",
		description: "Microphone input for formant analysis",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.mediaDevices,
		create: (options) => createInput(INPUT_TYPES.MICROPHONE_FORMANT, options)
	},
	{
		id: INPUT_TYPES.LEAP_MOTION,
		type: INPUT_DEFINITIONS[INPUT_TYPES.LEAP_MOTION].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.LEAP_MOTION].subtype,
		name: "Leap Motion",
		description: "Hand gesture tracking via Leap Motion device",
		isAvailable: () => typeof window !== "undefined" && !!(window as any).Leap,
		create: (options) => createInput(INPUT_TYPES.LEAP_MOTION, options)
	},
	{
		id: INPUT_TYPES.ONSCREEN_KEYBOARD,
		type: INPUT_DEFINITIONS[INPUT_TYPES.ONSCREEN_KEYBOARD].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.ONSCREEN_KEYBOARD].subtype,
		name: "Onscreen Keyboard",
		description: "Mouse-based virtual keyboard input",
		isAvailable: () => true,
		create: (options) => createInput(INPUT_TYPES.ONSCREEN_KEYBOARD, options)
	},
	{
		id: INPUT_TYPES.PROMPT_AI,
		type: INPUT_DEFINITIONS[INPUT_TYPES.PROMPT_AI].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.PROMPT_AI].subtype,
		name: "PromptAI Generator",
		description:
			"Generate melodies, bass lines, drums and chords with built-in browser AI; no API key required",
		isAvailable: () => !!browserAI(),
		create: (options) => createInput(INPUT_TYPES.PROMPT_AI, options)
	},
	{
		id: INPUT_TYPES.PROMPT_AI_SPEECH,
		type: INPUT_DEFINITIONS[INPUT_TYPES.PROMPT_AI_SPEECH].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.PROMPT_AI_SPEECH].subtype,
		name: "PromptAI Speech",
		description:
			"AI-powered input with speech recognition for generating note sequences via voice",
		isAvailable: () =>
			!!browserAI() &&
			typeof window !== "undefined" &&
			(!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition),
		create: (options) => createInput(INPUT_TYPES.PROMPT_AI_SPEECH, options)
	},
	{
		id: INPUT_TYPES.MIDI_TRANSPORT_CLOCK,
		type: INPUT_DEFINITIONS[INPUT_TYPES.MIDI_TRANSPORT_CLOCK].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.MIDI_TRANSPORT_CLOCK].subtype,
		name: "MIDI Transport Clock",
		description:
			"MIDI transport clock input for timing synchronization (24 clocks per quarter note)",
		isAvailable: () => true, // Available on all platforms with MIDI support
		create: (options) => createInput(INPUT_TYPES.MIDI_TRANSPORT_CLOCK, options)
	},
	{
		id: INPUT_TYPES.MUSIC_MOUSE,
		type: INPUT_DEFINITIONS[INPUT_TYPES.MUSIC_MOUSE].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.MUSIC_MOUSE].subtype,
		name: "Music Mouse",
		description:
			"Cursor-controlled musical instrument inspired by Laurie Spiegel's classic Music Mouse",
		isAvailable: () => true,
		create: (options) => createInput(INPUT_TYPES.MUSIC_MOUSE, options)
	},
	{
		id: INPUT_TYPES.MICROPHONE_PITCH,
		type: INPUT_DEFINITIONS[INPUT_TYPES.MICROPHONE_PITCH].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.MICROPHONE_PITCH].subtype,
		name: "Microphone Pitch (ML)",
		description:
			"Polyphonic pitch detection from microphone using Spotify's Basic Pitch neural network",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.mediaDevices,
		create: (options) => createInput(INPUT_TYPES.MICROPHONE_PITCH, options)
	},
	{
		id: INPUT_TYPES.DVS_CONTROL_VINYL,
		type: INPUT_DEFINITIONS[INPUT_TYPES.DVS_CONTROL_VINYL].type,
		subtype: INPUT_DEFINITIONS[INPUT_TYPES.DVS_CONTROL_VINYL].subtype,
		name: "DVS Control Vinyl",
		description:
			"Control vinyl pilot-tone clock - estimates relative speed and generates DVS_CLOCK or MIDI_CLOCK (no direction or absolute position decoding)",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator.mediaDevices,
		create: (options) => createInput(INPUT_TYPES.DVS_CONTROL_VINYL, options)
	}
]
onMidiDeviceProfilesChanged(() => {
	for (const [id, profile] of Object.entries(MIDI_DEVICE_PROFILES)) {
		if (INPUT_FACTORIES.some((factory) => factory.id === id)) {
			continue
		}
		INPUT_FACTORIES.push({
			id,
			name: profile.name,
			description: profile.description,
			type: "midi",
			subtype: "device",
			isAvailable: () => typeof document !== "undefined",
			create: (options) => createInput(id, options)
		})
	}
})

/**
 * Get all available input factories
 */
export function getAvailableInputFactories(): InputFactory[] {
	return INPUT_FACTORIES.filter((factory) => factory.isAvailable())
}

/**
 * Create an input instance by factory ID
 */
export async function createInputById(
	id: string,
	options?: Record<string, any>
): Promise<IAudioInput> {
	if (!INPUT_FACTORIES.some((factory) => factory.id === id)) {
		await ensureMidiDeviceProfile(id)
	}
	const factory = INPUT_FACTORIES.find((f) => f.id === id)
	if (!factory) {
		throw new Error(`Input factory not found: ${id}`)
	}
	if (!factory.isAvailable()) {
		throw new Error(`Input is not available: ${factory.name}`)
	}
	return defineDevice(await factory.create(options), { factory: "input", type: id, options })
}