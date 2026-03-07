/**
 * Conversion Utilities
 * Convert between MIDI notes, frequencies, note names, and timing units
 */

// Conversion Functions
export { centsToPitch } from './cents-to-pitch'
export { convertNoteNumberToColour } from './note-to-colour'
export { dbToLinear } from './decibels-to-linear'
export { frequencyToSemitones } from './frequency-to-semitones'
export { frequencyToNote, frequencyToNoteCents } from './frequency-to-note'
export { linearToDb } from './linear-to-decibels'
export { noteNumberToFrequency, midiNoteToFrequency } from './note-to-frequency'
export { noteNumberToKeyName } from './note-to-key-name'
export { noteNumberToName } from './note-to-name'
export { noteNumberToOctave } from './note-to-octave'
export { pitchToCents } from './pitch-to-cents'
export { pulsesToSeconds } from './pulses-to-seconds'
export { pulsesToSamples } from './pulses-to-samples'
export { secondsToBpm } from './seconds-to-bpm'
export { secondsToPulses } from './seconds-to-pulses'
export { samplesToPulses } from './samples-to-pulses'