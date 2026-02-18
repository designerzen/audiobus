/**
 * MIDI Module
 * MIDI protocol handling, channels, and commands
 */

// MIDI constants
export * from './midi-constants.js'

// MIDI commands
export {
  MIDICommand,
  parseMIDICommand,
  createMIDICommand,
} from './midi-command.ts'

// MIDI channels
export {
  MIDIChannels,
  getMIDIChannelName,
  parseMIDIChannel,
} from './midi-channels.ts'

// MIDI requested commands
export {
  MIDIRequestedCommand,
} from './midi-requested-command.ts'

// MIDI 2.0 utilities
export {
  MIDI2Utils,
  convertMIDI1toMIDI2,
  convertMIDI2toMIDI1,
} from './midi2-utils.ts'

// Bluetooth MIDI
export * from './midi-ble/index.ts'

