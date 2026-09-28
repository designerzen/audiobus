/**
 * Type definitions for the Rompler (sample-based) instrument system
 */

/**
 * Audio data returned from fetch worker
 */
export interface AudioData {
	buffer: AudioBuffer
	name: string
}

/**
 * Sound font pack configuration
 */
export interface SoundFontPack {
	name: string
	url: string
	uri: string
	soundfont: string
	suffix: string
	defaultPreset?: string
	descriptor?: SoundFontDescriptor
	descriptorPath?: string
}

/**
 * Sound font descriptor metadata
 */
export interface SoundFontDescriptor {
	name: string
	author?: string
	license?: string
	instruments: InstrumentDescriptor[]
}

/**
 * Individual instrument descriptor
 */
export interface InstrumentDescriptor {
	name: string
	family: string
	title: string
	presets: PresetDescriptor[]
	data?: Record<string, any>
}

/**
 * Preset descriptor for an instrument
 */
export interface PresetDescriptor {
	name: string
	index?: number
	samples?: Record<string, any>
}

/**
 * Audio sample buffer data
 */
export interface AudioSampleData {
	buffer: AudioBuffer
	name: string
	pitch?: number
	envelope?: EnvelopeSettings
}

/**
 * Envelope/ADSR settings
 */
export interface EnvelopeSettings {
	attack: number
	decay: number
	sustain: number
	release: number
}

/**
 * Options for sample instrument
 */
export interface SampleInstrumentOptions {
	audioContext?: AudioContext
	envelope?: EnvelopeSettings
	polyphony?: number
	title?: string
}

/**
 * Options for sound font instrument
 */
export interface SoundFontInstrumentOptions extends SampleInstrumentOptions {
	defaultPreset?: string
	packData?: SoundFontPack
	offlineAudioContext?: OfflineAudioContext
}

/**
 * Progress callback for instrument loading
 */
export type ProgressCallback = (progress: {
	progress: number
	instrumentName: string
}) => void

/**
 * Worker message for audio fetching
 */
export interface WorkerAudioMessage {
	command: string
	instrumentName?: string
	soundfontPath?: string
	presetSamplePath?: string
	data?: any
}

/**
 * Audio buffers collection
 */
export type AudioBuffers = Record<string, AudioBuffer>

/**
 * Instrument pack collection
 */
export type InstrumentPackMap = Record<string, SoundFontPack>

/**
 * Audio sample utilities
 */
export interface AudioSampleUtils {
	decodeAudioData: (audioData: ArrayBuffer, audioContext: AudioContext) => Promise<AudioBuffer>
	encodeAudioData?: (audioBuffer: AudioBuffer) => Promise<ArrayBuffer>
}
