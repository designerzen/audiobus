# @harmoneasy/audiobus

Core audio engine for HarmonEasy with MIDI processing, synthesis, and audio routing.

## Overview

AudioBus is the heart of HarmonEasy, providing:
- Web Audio API synthesis and effects
- MIDI device input/output management
- Real-time audio routing and mixing
- Polyphonic note handling
- Timing and synchronization
- Music theory utilities (scales, intervals, chords)
- Note conversion and frequency calculations
- Persistent storage via OPFS

## Installation

```bash
pnpm install @harmoneasy/audiobus
```

## Usage

### Basic Audio Engine

```typescript
import { AudioEngine } from '@harmoneasy/audiobus'

const engine = new AudioEngine()
await engine.initialize()

// Play a note
await engine.noteOn(60, 100) // Middle C, velocity 100
await engine.noteOff(60)
```

### Input/Output Factory Pattern

```typescript
import { createInputById, createOutputById } from '@harmoneasy/audiobus'
import * as INPUT_TYPES from '@harmoneasy/audiobus/io'

// Create MIDI input
const midiInput = await createInputById(INPUT_TYPES.WEBMIDI)

// Create synthesizer output
const synth = await createOutputById(INPUT_TYPES.WEB_AUDIO)
```

### MIDI Processing

```typescript
import { MIDIDevice } from '@harmoneasy/audiobus/midi'

const device = new MIDIDevice(midiDeviceInput)
device.onNoteOn((note, velocity) => {
  console.log(`Note ${note} played with velocity ${velocity}`)
})
```

### Instruments

```typescript
import { Synth, Oscillator } from '@harmoneasy/audiobus/instruments'

const synth = new Synth(audioContext)
await synth.noteOn(60, 0.8)
```

### Timing & Synchronization

```typescript
import { Timer } from '@harmoneasy/audiobus/timing'

const timer = new Timer()
timer.start()

// Schedule events at specific times
timer.schedule(() => {
  engine.noteOn(64, 100)
}, 1000) // After 1 second
```

### Music Theory

```typescript
import { Scale, Interval, Chord } from '@harmoneasy/audiobus/tuning'

const scale = new Scale('major', 60) // C Major starting at C4
const notes = scale.getIntervalNotes(0, 4) // Get first 4 notes

const chord = new Chord('maj7', 60)
console.log(chord.notes) // [60, 64, 67, 71]
```

### Note Conversion

```typescript
import { noteToFrequency, frequencyToNote, midiToNote } from '@harmoneasy/audiobus/conversion'

const freq = noteToFrequency(60) // 261.63 Hz
const note = frequencyToNote(261.63) // 60
const name = midiToNote(60) // 'C4'
```

### Storage

```typescript
import { OPFSStorage } from '@harmoneasy/audiobus/storage'

const storage = new OPFSStorage()
await storage.save('recording', audioData)
const data = await storage.load('recording')
```

## API Reference

### Classes

- **AudioEngine** - Main audio engine
- **MIDIDevice** - MIDI input/output abstraction
- **Synth** - Polyphonic synthesizer
- **Oscillator** - Waveform oscillator
- **Timer** - Audio timing and scheduling
- **Scale** - Music scale representation
- **Chord** - Chord generation
- **Interval** - Interval calculations
- **OPFSStorage** - File storage via OPFS

### Functions

- `createInputById(id)` - Create audio input
- `createOutputById(id)` - Create audio output
- `getAvailableInputFactories()` - List available inputs
- `getAvailableOutputFactories()` - List available outputs
- `noteToFrequency(note)` - Convert MIDI note to frequency
- `frequencyToNote(freq)` - Convert frequency to MIDI note
- `midiToNote(midi)` - Convert MIDI number to note name

## Architecture

```
AudioBus
├── instruments/      # Synths, oscillators, effects
├── io/              # Input/output devices and factories
├── midi/            # MIDI protocol handling
├── timing/          # Audio clock and scheduling
├── tuning/          # Music theory (scales, chords, intervals)
├── conversion/      # Note/frequency conversions
└── storage/         # OPFS file storage
```

## Dependencies

- `standardized-audio-context` - Consistent Audio API access
- `webmidi` - Web MIDI API
- `@harmoneasy/pitfalls` - Music theory utilities
- `@msgpack/msgpack` - Binary serialization

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

Requires:
- Web Audio API
- Web MIDI API (optional)
- Web Bluetooth API (optional)
- OPFS (optional, for storage)

## License

MIT

## See Also

- [@harmoneasy/pitfalls](../pitfalls) - Music theory utilities
- [@harmoneasy/midi-ble](../midi-ble) - Bluetooth MIDI
- [HarmonEasy](../) - Main application
