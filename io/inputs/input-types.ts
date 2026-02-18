/**
 * Input type identifiers
 * Single source of truth for input IDs used throughout the application
 */

export const KEYBOARD = "keyboard" as const
export const GAMEPAD = "gamepad" as const
export const GAMEPAD_MUSIC = "gamepad-music" as const
export const WEBMIDI = "webmidi" as const
export const NATIVE_MIDI = "native-midi" as const
export const MIDI2_NATIVE = "midi2-native" as const
export const BLE_MIDI = "ble-midi" as const
export const MICROPHONE_FORMANT = "microphone-formant" as const
export const LEAP_MOTION = "leap-motion" as const
export const ONSCREEN_KEYBOARD = "onscreen-keyboard" as const
export const PROMPT_AI = "prompt-ai" as const
export const MIDI_TRANSPORT_CLOCK = "midi-transport-clock" as const

export type InputId =
	| typeof KEYBOARD
	| typeof GAMEPAD
	| typeof GAMEPAD_MUSIC
	| typeof WEBMIDI
	| typeof NATIVE_MIDI
	| typeof MIDI2_NATIVE
	| typeof BLE_MIDI
	| typeof MICROPHONE_FORMANT
	| typeof LEAP_MOTION
	| typeof ONSCREEN_KEYBOARD
	| typeof PROMPT_AI
	| typeof MIDI_TRANSPORT_CLOCK
