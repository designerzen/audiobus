/**
 * MIDI Module
 * MIDI protocol handling, channels, and commands
 */

// MIDI constants
export * from "./midi-constants.js"

// MIDI commands
export { default as MIDICommand } from "./midi-command.ts"

// MIDI channels
export { ALL_MIDI_CHANNELS, ALL_MIDI_CHANNEL_LABELS } from "./midi-channels.ts"

// MIDI requested commands
export { default as MIDIRequestedCommand } from "./midi-requested-command.ts"

// MIDI 2.0 utilities
export * from "./midi2-utils.ts"

// Feedback loop protection shared by MIDI inputs and outputs
export * from "./midi-echo-guard.ts"

// Electron native MIDI, from either preload shape
export * from "./native-midi-bridge.ts"
