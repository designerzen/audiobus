/**
 * Input type identifiers
 * Single source of truth for input IDs used throughout the application
 */

export const KEYBOARD = "keyboard" as const
export const SCALE_EXPLORER = "scale-explorer" as const
export const MIDI_FILE = "midi-file" as const
export const STEP_SEQUENCER = "step-sequencer" as const
export const PADS = "pads" as const
export const MICROPHONE_TRIGGER = "microphone-trigger" as const
export const CAMERA_GESTURES = "camera-gestures" as const
export const EVENT_LOOP = "event-loop" as const
export const OSC = "osc" as const
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
export const AI_IMPROV = "ai-improv" as const
export const AI_MELODY = "ai-melody" as const
export const AI_DRUMS = "ai-drums" as const
export const AI_MUSIC_VAE = "ai-music-vae" as const
export const AI_TRIO = "ai-trio" as const
export const PROMPT_AI_SPEECH = "prompt-ai-speech" as const
export const MIDI_TRANSPORT_CLOCK = "midi-transport-clock" as const
export const MUSIC_MOUSE = "music-mouse" as const
export const MICROPHONE_PITCH = "microphone-pitch" as const
export const DVS_CONTROL_VINYL = "dvs-control-vinyl" as const

export type InputId =
	| typeof SCALE_EXPLORER
	| (string & {})
	| typeof AI_IMPROV
	| typeof AI_MELODY
	| typeof AI_DRUMS
	| typeof AI_MUSIC_VAE
	| typeof AI_TRIO
	| typeof STEP_SEQUENCER
	| typeof PADS
	| typeof MICROPHONE_TRIGGER
	| typeof CAMERA_GESTURES
	| typeof EVENT_LOOP
	| typeof OSC
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
	| typeof PROMPT_AI_SPEECH
	| typeof MIDI_TRANSPORT_CLOCK
	| typeof MUSIC_MOUSE
	| typeof MICROPHONE_PITCH
	| typeof DVS_CONTROL_VINYL

export const SVG_KEYBOARD = "svg-keyboard" as const
export const CIRCULAR_CONTROLLER = "circular-controller" as const
export const STAR_CONTROLLER = "star-controller" as const
export const SOUND_WHEEL = "sound-wheel" as const
export const RELATIVE_TOUCH_CONTROLLER = "relative-touch-controller" as const
export const XY_PITCH_CONTROLLER = "xy-pitch-controller" as const
export const PITCH_BEND_GRID = "pitch-bend-grid" as const
export const NOTE_SLIDER = "note-slider" as const
export const NOTE_DIAL = "note-dial" as const
export const AUDIO_SWITCH = "audio-switch" as const
export const PIANO_ROLL = "piano-roll" as const