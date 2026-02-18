/**
 * Output type identifiers
 * Single source of truth for output IDs used throughout the application
 */

export const CONSOLE = "console" as const
export const PINK_TROMBONE = "pink-trombone" as const
export const NOTATION = "notation" as const
export const SPECTRUM_ANALYSER = "spectrum-analyser" as const
export const SPEECH_SYNTHESIS = "speech-synthesis" as const
export const VIBRATOR = "vibrator" as const
export const WAM2 = "wam2" as const
export const WEBMIDI = "webmidi" as const
export const NATIVE_MIDI = "native-midi" as const
export const BLE_MIDI = "ble-midi" as const
export const MIDI2 = "midi2" as const
export const MIDI2_NATIVE = "midi2-native" as const
export const SUPERSONIC = "supersonic" as const
export const METRONOME = "metronome" as const

export type OutputId =
	| typeof CONSOLE
	| typeof PINK_TROMBONE
	| typeof NOTATION
	| typeof SPECTRUM_ANALYSER
	| typeof SPEECH_SYNTHESIS
	| typeof VIBRATOR
	| typeof WAM2
	| typeof WEBMIDI
	| typeof NATIVE_MIDI
	| typeof BLE_MIDI
	| typeof MIDI2
	| typeof MIDI2_NATIVE
	| typeof SUPERSONIC
	| typeof METRONOME
