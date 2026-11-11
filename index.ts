/**
 * audiobus
 * Core audio engine with MIDI processing, synthesis, and audio routing
 */

// Core audio commands
export { IAudioCommand, AudioCommand, AudioCommandInterface } from "./commands/audio-command-interface.ts"

export { AudioCommand as AudioCommandClass } from "./commands/audio-command.ts"

export { AudioCommandFactory } from "./commands/audio-command-factory.ts"

export { AudioCommandEncoder } from "./commands/audio-command-encoder.ts"

export { AudioCommandDecoder } from "./commands/audio-command-decoder.ts"

// Audio events and recording
export { IAudioEvent, AudioEvent } from "./models/audio-event.ts"

export { AudioEventRecorder } from "./events/audio-event-recorder.ts"

// Note and track models
export { NoteModel } from "./models/note-model.ts"

export { AudioTrack } from "./models/audio-track.js"

// IO Chain - Input, Transformation, Output
export * from "./io/index.ts"

// MIDI functionality
export * from "./midi/index.ts"

// Music theory - Tuning and intervals
export * from "./tuning/index.ts"

// Note conversion utilities
export * from "./conversion/index.ts"

// Timing and synchronization
export * from "./timing/index.ts"

// Instruments and synthesis
export * from "./instruments/index.ts"
export * from "./synthesis/index.ts"

// Effects and processing
export * from "./effects/index.ts"

// Audio storage
export * from "./storage/index.ts"

// Hardware integration
export * from "./hardware/index.ts"

// Import/Export functionality
export * from "./importers/index.ts"
export * from "./exporters/index.ts"

// Web Audio Modules
export * from "./wam/index.ts"