/**
 * Factory for creating audio output instances
 * Handles instantiation of available output types
 */
import * as OUTPUT_TYPES from "./outputs/output-types.ts"
import type { IAudioOutput } from "./outputs/output-interface.ts"

export interface OutputFactory {
	id: string
	name: string
	description: string
	isAvailable: () => boolean
	create: (options?: Record<string, any>) => IAudioOutput | Promise<IAudioOutput>
}

/**
 * Lazy load output module by type
 * @param type Output type identifier
 * @returns Module wrapper with default export
 */
const loadSupportingLibrary = async (type: string) => {
	// Create and return instance based on type
	switch (type) {
		case OUTPUT_TYPES.CONSOLE:
			return await import("./outputs/output-console.ts")
		case OUTPUT_TYPES.PINK_TROMBONE:
			return await import("./outputs/output-pink-trombone.ts")
		case OUTPUT_TYPES.NOTATION:
			return await import("./outputs/output-notation.ts")
		case OUTPUT_TYPES.SPECTRUM_ANALYSER:
			return await import("./outputs/output-spectrum-analyser.ts")
		case OUTPUT_TYPES.SPEECH_SYNTHESIS:
			return await import("./outputs/output-speech-synthesis.ts")
		case OUTPUT_TYPES.VIBRATOR:
			return await import("./outputs/output-vibrator.ts")
		case OUTPUT_TYPES.WAM2:
			return await import("./outputs/output-wam2.ts")
		case OUTPUT_TYPES.WEBMIDI:
			return await import("./outputs/output-webmidi-device.ts")
		case OUTPUT_TYPES.NATIVE_MIDI:
			return await import("./outputs/output-native-midi-device.ts")
		case OUTPUT_TYPES.BLE_MIDI:
			return await import("./outputs/output-ble-midi-device.ts")
		case OUTPUT_TYPES.MIDI2:
			return await import("./outputs/output-midi2-device.ts")
		case OUTPUT_TYPES.MIDI2_NATIVE:
			return await import("./outputs/output-midi2-native-device.ts")
		case OUTPUT_TYPES.SUPERSONIC:
			return await import("./outputs/output-supersonic.ts")
		case OUTPUT_TYPES.METRONOME:
			return await import("./outputs/output-metronome.ts")
		default:
			throw new Error(`Unknown output type: ${type}`)
	}
}

/**
 * Load and instantiate an output for a given type
 * Tracks loaded libraries for future optimization with lazy loading
 * @param type Output type identifier
 * @returns Constructor class for the requested output type
 * @throws Error if the output type is unknown
 */
const loadedLibraries = new Map<string, OUTPUT_TYPES.OutputId>()
const loadSupportingLibraries = async (type: string): Promise<any> => {
	// Check if already loaded
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
 * Create an output instance for a given type
 * @param type Output type identifier
 * @param options Optional configuration for the output
 * @returns A new instance of the requested output type
 */
const createOutput = async (type: string, options?: Record<string, any>): Promise<IAudioOutput> => {
	const Class = await loadSupportingLibraries(type)
	
	// Handle special cases that need parameters
	if (type === OUTPUT_TYPES.SPECTRUM_ANALYSER) {
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
		const mixer = audioContext.createGain()
		return new Class(mixer)
	} else if (type === OUTPUT_TYPES.WAM2) {
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
		return new Class(audioContext, "")
	} else if (type === OUTPUT_TYPES.SUPERSONIC) {
		const output = new Class()
		output.connect()
		return output
	}
	
	return new Class(options)
}

/**
 * Available output factories
 * Add new outputs here as they become available
 * Uses lazy loading for better performance
 */
export const OUTPUT_FACTORIES: OutputFactory[] = [
	{
		id: OUTPUT_TYPES.CONSOLE,
		name: "Console",
		description: "Logs MIDI events to browser console (dev mode only)",
		isAvailable: () => import.meta.env.DEV,
		create: (options) => createOutput(OUTPUT_TYPES.CONSOLE, options),
	},
	{
		id: OUTPUT_TYPES.PINK_TROMBONE,
		name: "Pink Trombone",
		description: "Vocal synthesis engine with speech-like sounds",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.PINK_TROMBONE, options),
	},
	{
		id: OUTPUT_TYPES.NOTATION,
		name: "Notation",
		description: "Displays notes on a musical staff",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.NOTATION, options),
	},
	{
		id: OUTPUT_TYPES.SPECTRUM_ANALYSER,
		name: "Spectrum Analyser",
		description: "Visualizes audio spectrum using FFT analysis with realtime waveform display",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.SPECTRUM_ANALYSER, options),
	},
	{
		id: OUTPUT_TYPES.SPEECH_SYNTHESIS,
		name: "Speech Synthesis",
		description: "Uses the Web Speech Synthesis API to sing note names",
		isAvailable: () => typeof window !== "undefined" && !!window.speechSynthesis,
		create: (options) => createOutput(OUTPUT_TYPES.SPEECH_SYNTHESIS, options),
	},
	{
		id: OUTPUT_TYPES.VIBRATOR,
		name: "Vibrator",
		description: "Triggers device vibration when a note within a range is played",
		isAvailable: () => typeof navigator !== "undefined" && (!!navigator?.vibrate || !!(navigator as any)?.webkitVibrate || !!(navigator as any)?.mozVibrate),
		create: (options) => createOutput(OUTPUT_TYPES.VIBRATOR, options),
	},
	{
		id: OUTPUT_TYPES.WEBMIDI,
		name: "WebMIDI Device",
		description: "Sends MIDI messages to a connected WebMIDI device",
		isAvailable: () => typeof navigator !== "undefined" && !!(navigator as any).requestMIDIAccess,
		create: (options) => createOutput(OUTPUT_TYPES.WEBMIDI, options),
	},
	{
		id: OUTPUT_TYPES.NATIVE_MIDI,
		name: "Native MIDI Device",
		description: "Sends MIDI messages to a connected native OS MIDI device (Windows/macOS/Linux)",
		isAvailable: () => typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.type === "renderer", // Only available in Electron
		create: (options) => createOutput(OUTPUT_TYPES.NATIVE_MIDI, options),
	},
	{
		id: OUTPUT_TYPES.BLE_MIDI,
		name: "BLE MIDI",
		description: "BLE MIDI",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator?.bluetooth && !!navigator?.bluetooth?.requestDevice,
		create: (options) => createOutput(OUTPUT_TYPES.BLE_MIDI, options),
	},
	{
		id: OUTPUT_TYPES.MIDI2,
		name: "MIDI 2.0",
		description: "MIDI 2.0 device output",
		isAvailable: () => typeof navigator !== "undefined" && !!(navigator as any).requestMIDIAccess,
		create: (options) => createOutput(OUTPUT_TYPES.MIDI2, options),
	},
	{
		id: OUTPUT_TYPES.MIDI2_NATIVE,
		name: "MIDI 2.0 Native",
		description: "MIDI 2.0 output with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		isAvailable: () => typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.type === "renderer", // Only available in Electron
		create: (options) => createOutput(OUTPUT_TYPES.MIDI2_NATIVE, options),
	},
	{
		id: OUTPUT_TYPES.SUPERSONIC,
		name: "Supersonic",
		description: "SuperCollider-based sound synthesis engine",
		isAvailable: () => typeof AudioWorklet !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.SUPERSONIC, options),
	},
	{
		id: OUTPUT_TYPES.WAM2,
		name: "WAM2",
		description: "Manages the WAM2 Audio Engine",
		isAvailable: () => typeof AudioWorklet !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.WAM2, options),
	},
	{
		id: OUTPUT_TYPES.METRONOME,
		name: "Metronome",
		description: "Produces audible clicks in response to MIDI clock signals",
		isAvailable: () => typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.METRONOME, options),
	}
]

/**
 * Get all available output factories
 */
export function getAvailableOutputFactories(): OutputFactory[] {
	return OUTPUT_FACTORIES.filter((factory) => factory.isAvailable())
}

/**
 * Create an output instance by factory ID
 */
export async function createOutputById(id: string, options?: Record<string, any>): Promise<IAudioOutput> {
	const factory = OUTPUT_FACTORIES.find((f) => f.id === id)
	if (!factory) {
		throw new Error(`Output factory not found: ${id}`)
	}
	const isAvailable = factory.isAvailable()
	if (!isAvailable) {
		throw new Error(`Output is not available: ${factory.name}`)
	}
	return factory.create(options)
}
