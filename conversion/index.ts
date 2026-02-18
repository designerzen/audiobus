/**
 * Note Conversion Utilities
 * Convert between MIDI notes, frequencies, and note names
 */

export {
  noteToFrequency,
  frequencyToNote,
  midiToNote,
  noteToCents,
  centsToFrequency,
} from './note-conversion.ts'

export {
  NoteNameParser,
  parseNoteName,
  getNoteOctave,
  getNotePitch,
} from './note-name-parser.ts'

export {
  FrequencyCalculator,
  getA4Frequency,
  setA4Frequency,
} from './frequency-calculator.ts'
