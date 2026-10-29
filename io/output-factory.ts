import { OUTPUT_DEFINITIONS } from "./output-definitions.ts"
import { getAudioDestination } from '../audio-destination'
import type { DeviceClassification, DeviceAttribution } from "./device-classification.ts"
import { defineDevice } from './device-definition'
import wam2Registry, { WAM2_INSTRUMENTS, wam2OutputId } from '../wam/registry'
/**
 * Factory for creating audio output instances
 * Handles instantiation of available output types
 */
import * as OUTPUT_TYPES from "./outputs/output-types.ts"
import type { IAudioOutput } from "./outputs/output-interface.ts"

export interface OutputFactory extends DeviceClassification {
	id: string
	name: string
	description: string
	title?: string
	category?: string
	attribution?: DeviceAttribution
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
        case OUTPUT_TYPES.PERFORMANCE:
            return await import('./outputs/output-performance.ts')
        case OUTPUT_TYPES.RECORDER:
            return await import('./outputs/output-recorder.ts')
		case OUTPUT_TYPES.DRUM_ACCOMPANIMENT:
			return await import('./outputs/output-drum-accompaniment.ts')
		case OUTPUT_TYPES.CONSOLE:
			return await import("./outputs/output-console.ts")
		case OUTPUT_TYPES.DESCRIBE:
			return await import("./outputs/output-describe.ts")
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
		case OUTPUT_TYPES.MOOG:
			return await import("./outputs/output-moog.ts")
		case OUTPUT_TYPES.TB303:
			return await import('./outputs/output-tb303.ts')
		case OUTPUT_TYPES.WAM:
			return await import("./outputs/output-wam.ts")
		case OUTPUT_TYPES.YOSHIMI:
			return await import("./outputs/output-yoshimi.ts")
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
		case OUTPUT_TYPES.AUDIO_CLICK:
			return await import("./outputs/output-audio-click.ts")
		case OUTPUT_TYPES.BUTTERCHURN:
			return await import("./outputs/output-butterchurn.ts")
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
const loadedLibraries = new Map<string, new (...args: any[]) => any>()
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
 * @param options Optional configuration for the output (must include audioContext where required)
 * @returns A new instance of the requested output type
 */
const createOutput = async (type: string, options?: Record<string, any>): Promise<IAudioOutput> => {
	const Class = await loadSupportingLibraries(type)
	
	// Handle special cases that need parameters
	if (type === OUTPUT_TYPES.SPECTRUM_ANALYSER) {
		if (!options?.mixer) {
			throw new Error('SPECTRUM_ANALYSER output requires mixer (GainNode) in options')
		}
		if (!options?.audioContext) {
			throw new Error('SPECTRUM_ANALYSER output requires audioContext in options')
		}
		return new Class(options.mixer, options.audioContext)
	} else if (type === OUTPUT_TYPES.BUTTERCHURN) {
		if (!options?.mixer) {
			throw new Error('BUTTERCHURN output requires mixer (GainNode) in options')
		}
		if (!options?.audioContext) {
			throw new Error('BUTTERCHURN output requires audioContext in options')
		}
		return new Class(options.mixer, options.audioContext)
	} else if (type === OUTPUT_TYPES.WAM2 || type === OUTPUT_TYPES.WAM) {
		if (!options?.audioContext) {
			throw new Error('WAM2 output requires audioContext in options')
		}
		return new Class(options.audioContext, options.pluginUrl, options.name, options.mixer)
	} else if (type === OUTPUT_TYPES.MOOG || type === OUTPUT_TYPES.TB303) {
		if (!options?.audioContext) throw new Error(`${type} output requires audioContext in options`)
		return new Class(options.audioContext, options.mixer)
	} else if (type === OUTPUT_TYPES.YOSHIMI) {
		if (!options?.audioContext) {
			throw new Error('YOSHIMI output requires audioContext in options')
		}
		return new Class(options.audioContext, options.name, options.mixer)
	} else if (type === OUTPUT_TYPES.SUPERSONIC) {
		const output = new Class(options?.audioContext ? getAudioDestination(options.audioContext) : undefined)
		output.connect()
		return output
	} else if (type === OUTPUT_TYPES.SPEECH_SYNTHESIS) {
		return new Class(options, options?.audioContext)
	} else if (type === OUTPUT_TYPES.METRONOME || type === OUTPUT_TYPES.AUDIO_CLICK) {
		if (!options?.audioContext) {
			throw new Error(`${type} output requires audioContext in options`)
		}
		return new Class(options.audioContext)
	}
	
	return new Class(type === OUTPUT_TYPES.WEBMIDI ? { autoConnect: true, ...options } : options)
}

/**
 * Available output factories
 * Add new outputs here as they become available
 * Uses lazy loading for better performance
 */
export const OUTPUT_FACTORIES: OutputFactory[] = [
    {
        ...OUTPUT_DEFINITIONS[OUTPUT_TYPES.PERFORMANCE],
        isAvailable: () => typeof requestAnimationFrame === 'function',
        create: options => createOutput(OUTPUT_TYPES.PERFORMANCE, options),
    },
    {
        ...OUTPUT_DEFINITIONS[OUTPUT_TYPES.RECORDER],
        isAvailable: () => typeof AudioContext !== 'undefined',
        create: options => createOutput(OUTPUT_TYPES.RECORDER, options),
    },
	{
		...OUTPUT_DEFINITIONS[OUTPUT_TYPES.TB303],
		isAvailable: () => typeof AudioWorkletNode !== 'undefined',
		create: options => createOutput(OUTPUT_TYPES.TB303, options),
	},
	{
		...OUTPUT_DEFINITIONS[OUTPUT_TYPES.DRUM_ACCOMPANIMENT],
		isAvailable: () => typeof AudioContext !== 'undefined',
		create: options => createOutput(OUTPUT_TYPES.DRUM_ACCOMPANIMENT, options),
	},
	{
		...OUTPUT_DEFINITIONS[OUTPUT_TYPES.MOOG],
		isAvailable: () => typeof AudioWorklet !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.MOOG, options),
	},
	...Object.values(OUTPUT_DEFINITIONS).filter(definition => definition.id.startsWith(OUTPUT_TYPES.WEBCLAP_PREFIX)).map(definition => ({
		...definition,
		isAvailable: () => typeof AudioWorkletNode !== 'undefined' && typeof WebAssembly !== 'undefined',
		create: async (options?: Record<string, any>) => {
			if (!options?.audioContext) throw new Error('WebCLAP requires audioContext in options')
			const { default: Instrument } = await import('../instruments/clap/clap-instrument')
			const output = new Instrument(options.audioContext, options.defaultPatchId ?? definition.id.slice(OUTPUT_TYPES.WEBCLAP_PREFIX.length), { ...options, routeAudio: true })
			try { await output.connect(); return output }
			catch (error) { await output.disconnect(); output.output.disconnect(); throw error }
		}
	})),
	...WAM2_INSTRUMENTS.map(plugin => ({
		...OUTPUT_DEFINITIONS[wam2OutputId(plugin)],
		isAvailable: () => typeof AudioWorkletNode !== 'undefined',
		create: (options?: Record<string, any>) => createOutput(OUTPUT_TYPES.WAM2, {
			...options, pluginUrl: options?.pluginUrl ?? wam2Registry.getPluginUrl(plugin), name: plugin.name,
		}),
	})),
	{
		id: OUTPUT_TYPES.DESCRIBE,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.DESCRIBE].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.DESCRIBE].subtype,
		name: "Describe",
		description: "Describes notes, chords, extensions and inversions in musical language",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.DESCRIBE, options),
	},
	{
		id: OUTPUT_TYPES.CONSOLE,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.CONSOLE].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.CONSOLE].subtype,
		name: "Console",
		description: "Logs MIDI events to browser console (dev mode only)",
		isAvailable: () => import.meta.env.DEV,
		create: (options) => createOutput(OUTPUT_TYPES.CONSOLE, options),
	},
	{
		id: OUTPUT_TYPES.PINK_TROMBONE,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.PINK_TROMBONE].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.PINK_TROMBONE].subtype,
		name: "Pink Trombone",
		description: "Vocal synthesis engine with speech-like sounds",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.PINK_TROMBONE, options),
	},
	{
		id: OUTPUT_TYPES.NOTATION,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.NOTATION].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.NOTATION].subtype,
		name: "Notation",
		description: "Displays notes on a musical staff",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.NOTATION, options),
	},
	{
		id: OUTPUT_TYPES.SPECTRUM_ANALYSER,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SPECTRUM_ANALYSER].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SPECTRUM_ANALYSER].subtype,
		name: "Spectrum Analyser",
		description: "Visualizes audio spectrum using FFT analysis with realtime waveform display",
		isAvailable: () => true,
		create: (options) => createOutput(OUTPUT_TYPES.SPECTRUM_ANALYSER, options),
	},
	{
		id: OUTPUT_TYPES.SPEECH_SYNTHESIS,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SPEECH_SYNTHESIS].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SPEECH_SYNTHESIS].subtype,
		name: "Speech Synthesis",
		description: "Reads note names with Kokoro, with system voices as a fallback",
		isAvailable: () => typeof window !== "undefined" && (
			(typeof Worker !== "undefined" && typeof AudioContext !== "undefined") || !!window.speechSynthesis
		),
		create: (options) => createOutput(OUTPUT_TYPES.SPEECH_SYNTHESIS, options),
	},
	{
		id: OUTPUT_TYPES.VIBRATOR,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.VIBRATOR].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.VIBRATOR].subtype,
		name: "Vibrator",
		description: "Triggers device vibration when a note within a range is played",
		isAvailable: () => true, // Available on all platforms - supports mobile vibration API and gamepad vibration
		create: (options) => createOutput(OUTPUT_TYPES.VIBRATOR, options),
	},
	{
		id: OUTPUT_TYPES.WEBMIDI,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WEBMIDI].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WEBMIDI].subtype,
		name: "WebMIDI Device",
		description: "Sends MIDI messages to a connected WebMIDI device",
		isAvailable: () => typeof navigator !== "undefined" && !!(navigator as any).requestMIDIAccess,
		create: (options) => createOutput(OUTPUT_TYPES.WEBMIDI, options),
	},
	{
		id: OUTPUT_TYPES.NATIVE_MIDI,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.NATIVE_MIDI].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.NATIVE_MIDI].subtype,
		name: "Native MIDI Device",
		description: "Sends MIDI messages to a connected native OS MIDI device (Windows/macOS/Linux)",
		isAvailable: () => typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.type === "renderer", // Only available in Electron
		create: (options) => createOutput(OUTPUT_TYPES.NATIVE_MIDI, options),
	},
	{
		id: OUTPUT_TYPES.BLE_MIDI,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.BLE_MIDI].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.BLE_MIDI].subtype,
		name: "BLE MIDI",
		description: "BLE MIDI",
		isAvailable: () => typeof navigator !== "undefined" && !!navigator?.bluetooth && !!navigator?.bluetooth?.requestDevice,
		create: (options) => createOutput(OUTPUT_TYPES.BLE_MIDI, options),
	},
	{
		id: OUTPUT_TYPES.MIDI2,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.MIDI2].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.MIDI2].subtype,
		name: "MIDI 2.0",
		description: "MIDI 2.0 device output",
		isAvailable: () => typeof navigator !== "undefined" && !!(navigator as any).requestMIDIAccess,
		create: (options) => createOutput(OUTPUT_TYPES.MIDI2, options),
	},
	{
		id: OUTPUT_TYPES.MIDI2_NATIVE,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.MIDI2_NATIVE].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.MIDI2_NATIVE].subtype,
		name: "MIDI 2.0 Native",
		description: "MIDI 2.0 output with per-note controllers via native OS MIDI (16-bit resolution, Windows/macOS/Linux)",
		isAvailable: () => typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.type === "renderer", // Only available in Electron
		create: (options) => createOutput(OUTPUT_TYPES.MIDI2_NATIVE, options),
	},
	{
		id: OUTPUT_TYPES.SUPERSONIC,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SUPERSONIC].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.SUPERSONIC].subtype,
		name: "Supersonic",
		description: "SuperCollider-based sound synthesis engine",
		isAvailable: () => typeof AudioWorklet !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.SUPERSONIC, options),
	},
	{
		id: OUTPUT_TYPES.WAM2,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WAM2].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WAM2].subtype,
		name: "WAM2",
		description: "Manages the WAM2 Audio Engine",
		isAvailable: () => typeof AudioWorkletNode !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.WAM2, options),
	},
	{
		id: OUTPUT_TYPES.WAM,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WAM].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WAM].subtype,
		name: "WAM",
		description: OUTPUT_DEFINITIONS[OUTPUT_TYPES.WAM].description,
		isAvailable: () => typeof AudioWorkletNode !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.WAM, options),
	},
	{
		id: OUTPUT_TYPES.YOSHIMI,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.YOSHIMI].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.YOSHIMI].subtype,
		name: "Yoshimi",
		description: "Free and open source high quality software synthesizer with 700+ presets",
		isAvailable: () => typeof AudioWorkletNode !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.YOSHIMI, options),
	},
	{
		id: OUTPUT_TYPES.METRONOME,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.METRONOME].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.METRONOME].subtype,
		name: "Metronome",
		description: "Produces audible clicks in response to MIDI clock signals",
		isAvailable: () => typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.METRONOME, options),
	},
	{
		id: OUTPUT_TYPES.AUDIO_CLICK,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.AUDIO_CLICK].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.AUDIO_CLICK].subtype,
		name: "Audio Click",
		description: "Plays audio click sounds from a selected asset library on every bar",
		isAvailable: () => typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.AUDIO_CLICK, options),
	},
	{
		id: OUTPUT_TYPES.BUTTERCHURN,
		type: OUTPUT_DEFINITIONS[OUTPUT_TYPES.BUTTERCHURN].type,
		subtype: OUTPUT_DEFINITIONS[OUTPUT_TYPES.BUTTERCHURN].subtype,
		name: "Butterchurn",
		description: "WebGL music visualizer with animated psychedelic patterns synced to audio",
		isAvailable: () => typeof WebGL2RenderingContext !== "undefined",
		create: (options) => createOutput(OUTPUT_TYPES.BUTTERCHURN, options),
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
	return defineDevice(await factory.create(options), { factory: 'output', type: id, options })
}

