/**
 * Output type identifiers
 * Single source of truth for output IDs used throughout the application
 */

export const CONSOLE = "console" as const
export const RECORDER = 'recorder' as const
export const DESCRIBE = "describe" as const
export const PINK_TROMBONE = "pink-trombone" as const
export const NOTATION = "notation" as const
export const SPECTRUM_ANALYSER = "spectrum-analyser" as const
export const SPEECH_SYNTHESIS = "speech-synthesis" as const
export const VIBRATOR = "vibrator" as const
export const WAM2 = "wam2" as const
export const MOOG = "moog" as const
export const TB303 = 'tb303' as const
export const WAM = "wam" as const
export const YOSHIMI = "yoshimi" as const
export const WEBMIDI = "webmidi" as const
export const NATIVE_MIDI = "native-midi" as const
export const BLE_MIDI = "ble-midi" as const
export const MIDI2 = "midi2" as const
export const MIDI2_NATIVE = "midi2-native" as const
export const SUPERSONIC = "supersonic" as const
export const METRONOME = "metronome" as const
export const AUDIO_CLICK = "audio-click" as const
export const DRUM_ACCOMPANIMENT = 'drum-accompaniment' as const
export const BUTTERCHURN = "butterchurn" as const
export const WEBCLAP_PREFIX = 'webclap:' as const
export const webclapOutputId = (pluginId: string): `webclap:${string}` => `${WEBCLAP_PREFIX}${pluginId}`

export type OutputId =
    | typeof RECORDER
	| `webclap:${string}`
	| typeof CONSOLE
	| typeof DESCRIBE
	| typeof PINK_TROMBONE
	| typeof NOTATION
	| typeof SPECTRUM_ANALYSER
	| typeof SPEECH_SYNTHESIS
	| typeof VIBRATOR
	| typeof WAM2
	| typeof MOOG
	| typeof TB303
	| typeof WAM
	| typeof YOSHIMI
	| typeof WEBMIDI
	| typeof NATIVE_MIDI
	| typeof BLE_MIDI
	| typeof MIDI2
	| typeof MIDI2_NATIVE
	| typeof SUPERSONIC
	| typeof METRONOME
	| typeof AUDIO_CLICK
	| typeof DRUM_ACCOMPANIMENT
	| typeof BUTTERCHURN
