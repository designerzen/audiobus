# FAUST Instrument

A synthesizer module that loads and executes FAUST DSP (Functional Audio Stream) modules compiled to WebAssembly.

## Overview

FAUST is a functional programming language designed for real-time signal processing and synthesizer design. This instrument provides a bridge between FAUST DSP modules (compiled to `.wasm`) and the Harmoneasy audio engine.

## Features

- **WASM-based DSP**: Executes high-performance FAUST DSP modules compiled to WebAssembly
- **Polyphonic support**: 16-voice polyphony with automatic voice stealing
- **Dynamic module loading**: Load different FAUST DSP modules at runtime
- **Parameter control**: Real-time manipulation of DSP parameters
- **ADSR Envelope**: Built-in amplitude envelope (Attack, Decay, Sustain, Release)

## File Structure

```
faust/
├── faust-instrument.ts    # Main instrument class
├── faust-types.ts         # Type definitions
├── faust-registry.ts      # Module registry and management
├── index.ts               # Module exports
└── README.md              # This file
```

## Usage

### Basic Setup

```typescript
import { FAUSTInstrument } from "./instruments/faust"

// Create an instance
const faust = new FAUSTInstrument(audioContext)

// Connect to audio context
await faust.connect()

// Load a FAUST DSP module
await faust.loadModule("faust-sine")

// Play notes
faust.noteOn(60, 127)  // Middle C, max velocity
faust.noteOff(60)
```

### Module Registry

The `faust-registry.ts` manages available FAUST modules. Register modules before using them:

```typescript
import { faustRegistry } from "./instruments/faust"

faustRegistry.registerModule({
	id: "my-custom-dsp",
	name: "My Custom Synth",
	url: "/dsp/my-synth.wasm",
	category: "synthesis",
	inputs: 0,
	outputs: 1,
	parameters: [
		{ name: "freq", min: 20, max: 20000, default: 440 },
		{ name: "gain", min: 0, max: 1, default: 0.5 }
	]
})
```

## FAUST Module Requirements

FAUST DSP modules should:

1. **Compile to WebAssembly** using `faust2wasm` or similar compiler
2. **Export standard DSP interface**:
   - `init()` - Initialize with sample rate
   - `compute()` - Process a block of audio
   - `setParameter()` - Set parameter values
3. **Include metadata** in module definition

## Creating FAUST DSP Modules

### Basic FAUST Example

```faust
declare name "Simple Sine";
declare description "A simple sine oscillator";

freq = hslider("freq", 440, 20, 20000, 1);
gain = hslider("gain", 0.3, 0, 1, 0.01);

process = os.osc(freq) * gain;
```

Compile with:
```bash
faust2wasm -o sine.wasm sine.dsp
```

## Integration with Harmoneasy

The FAUST instrument is registered in `instrument-types.ts` and available through the instrument factory. It can be instantiated dynamically:

```typescript
import { INSTRUMENT_TYPE_FAUST } from "@audiobus/instruments"
import { instrumentFactory } from "@audiobus/instruments"

const faust = await instrumentFactory.createInstrument(
	INSTRUMENT_TYPE_FAUST,
	audioContext
)
```

## Architecture

```
FAUSTInstrument (IAudioOutput)
├── FAUSTRegistry (module management)
├── FAUSTVoice[] (16 voices for polyphony)
│   ├── ADSR Envelope
│   ├── Oscillator
│   └── Parameters
└── ScriptProcessor (audio generation)
```

## Voice Stealing

When all 16 voices are busy and a new note arrives:
1. The oldest active voice is released
2. The new note is assigned to that voice
3. This ensures continuous polyphonic playback

## Future Enhancements

- [ ] AudioWorklet support (replace ScriptProcessor)
- [ ] Advanced parameter interpolation
- [ ] MIDI CC mapping for parameters
- [ ] Preset/patch management
- [ ] Real-time parameter automation
- [ ] Multiple output channels support
