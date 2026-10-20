# Web CLAP Audio Output

The Web CLAP output allows harmoneasy to load and play CLAP (Common Language Audio Plugin) plugins that have been compiled to WebAssembly. This provides access to a cross-platform, standardized plugin format that can run in browsers.

## Overview

CLAP is a modern, open-source plugin standard designed for audio applications. Web CLAP extends this to WebAssembly, enabling:

- **Cross-platform compatibility**: Run the same plugin binary on any OS/architecture
- **Web-based distribution**: Host plugins as `.wclap` bundles or `.tar.gz` archives
- **Sandboxed execution**: Plugins run in isolated WASM environments
- **Standardized interface**: Common parameter automation, MIDI, and audio I/O

## Setup

### 1. Install Dependencies

The CLAP output is built into harmoneasy's audiobus package and requires only WebAssembly support (available in all modern browsers).

### 2. Create a Plugin Registry

Create a `clap-registry.json` file in your public directory to define available CLAP plugins:

```json
{
  "patches": [
    {
      "id": "my-synth-v1",
      "name": "My Synth",
      "url": "/clap-plugins/my-synth.wclap.tar.gz",
      "category": "Synthesis",
      "description": "A custom synthesizer plugin",
      "author": "Your Name",
      "version": "1.0.0",
      "factory": "my-synth"
    },
    {
      "id": "my-effect-v1",
      "name": "My Effect",
      "url": "/clap-plugins/my-effect.wclap.tar.gz",
      "category": "Effects",
      "description": "A custom audio effect",
      "author": "Your Name",
      "version": "1.0.0",
      "factory": "my-effect"
    }
  ]
}
```

### 3. Initialize the Registry in Your App

```typescript
import { initializeCLAPRegistry, clapRegistry } from '@audiobus/io/outputs'

// Initialize registry from default location (/clap-registry.json)
await initializeCLAPRegistry()

// Or add additional registries
await clapRegistry.addRegistry('https://example.com/plugins-registry.json')

// Get available patches
const patches = clapRegistry.getPatches()
console.log('Available CLAP plugins:', patches)
```

## Usage

### Creating a CLAP Output

```typescript
import { OutputCLAP, clapRegistry } from '@audiobus/io/outputs'

// Create CLAP output with available patches
const patches = clapRegistry.getPatches()
const clapOutput = new OutputCLAP(audioContext, patches)

// Connect to audio graph
await clapOutput.connect()

// Load a specific patch
await clapOutput.loadPatch('my-synth-v1')

// Add to output manager
outputManager.add(clapOutput)
```

### Using with the Factory

The CLAP output integrates with harmoneasy's output factory:

```typescript
import { createOutputById } from '@audiobus/io/output-factory'
import { clapRegistry } from '@audiobus/io/outputs'

const clapOutput = await createOutputById('clap', {
  audioContext: audioContext,
  patches: clapRegistry.getPatches()
})
```

### Playing Notes

```typescript
// Note on (MIDI note number 60 = middle C, velocity 100)
clapOutput.noteOn(60, 100)

// Note off
clapOutput.noteOff(60)

// Release all notes
clapOutput.allNotesOff()
```

### Working with Patches

```typescript
// Get all available patches
const patches = clapRegistry.getPatches()

// Search for patches by name
const synthPatches = clapRegistry.searchPatches('synth')

// Get patches by category
const effects = clapRegistry.getPatchesByCategory('Effects')

// Load a patch by ID
await clapOutput.loadPatch('my-synth-v1')

// Get current patch
const currentPatch = clapOutput.currentPatch
console.log('Playing:', currentPatch.name)
```

## Plugin Registry Structure

Each patch entry must include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the patch |
| `name` | string | Yes | Display name |
| `url` | string | Yes | URL to `.wclap` bundle or `.tar.gz` |
| `category` | string | No | Plugin category (e.g., "Synthesis", "Effects") |
| `description` | string | No | Plugin description |
| `author` | string | No | Plugin author |
| `version` | string | No | Plugin version |
| `factory` | string | No | Factory ID within the plugin |

## Plugin Bundle Format

CLAP plugins for web should follow this structure:

```
my-plugin.wclap/
├── module.wasm           # The compiled WASM module
├── manifest.json         # Plugin metadata
├── factory-presets/      # Factory preset files
│   ├── preset1.txt
│   └── preset2.txt
└── gui/                  # Optional web UI
    ├── index.html
    ├── style.css
    └── script.js
```

When distributed as a tar.gz:

```bash
tar czf my-plugin.wclap.tar.gz my-plugin.wclap/
```

## GUI Customization

The CLAP output provides a built-in GUI for patch selection:

```typescript
// Create GUI element
const guiElement = await clapOutput.createGui()
document.getElementById('controls').appendChild(guiElement)

// Clean up when done
await clapOutput.destroyGui()
```

The GUI includes:
- Patch selector dropdown
- Plugin metadata display
- Connection status indicator

## Capabilities

Check what features a CLAP output supports:

```typescript
clapOutput.hasAudioOutput()        // true - outputs audio
clapOutput.hasMidiOutput()         // false - doesn't send MIDI
clapOutput.hasAutomationOutput()   // true - supports parameter automation
clapOutput.hasMpeOutput()          // true - supports MPE
clapOutput.hasOscOutput()          // false
clapOutput.hasSysexOutput()        // true - can handle SysEx
```

## Lifecycle

```typescript
// Connect to audio context
await clapOutput.connect()

// Load patches
await clapOutput.loadPatch('synth-id')

// Use for audio processing
clapOutput.noteOn(60, 127)
clapOutput.noteOff(60)

// Clean up
clapOutput.allNotesOff()
await clapOutput.disconnect()
clapOutput.dispose()
```

## Troubleshooting

### Plugin won't load

- Verify the URL is accessible and returns valid WASM/tar.gz
- Check browser console for specific error messages
- Ensure AudioContext is created and passed to constructor
- Verify WebAssembly is supported

### Notes not playing

- Confirm `connect()` was called
- Check that a patch is loaded via `currentPatch`
- Verify note numbers are in valid MIDI range (0-127)
- Check `isConnected` property

### Registry not loading

- Verify `/clap-registry.json` exists in public directory
- Check network tab for fetch errors
- Ensure JSON format is valid
- Try manually adding patches: `clapRegistry.addPatch(...)`

## Web CLAP Resources

- [CLAP Specification](https://github.com/free-audio/clap)
- [Web CLAP Specification](https://github.com/free-audio/web-clap)
- [CLAP Plugin Development](https://github.com/free-audio/clap/tree/main/include)

## API Reference

### OutputCLAP

```typescript
class OutputCLAP implements IAudioOutput {
  // Properties
  uuid: string
  name: string
  description: string
  isConnected: boolean
  isHidden: boolean
  currentPatch: CLAPPatch | null
  availablePatches: CLAPPatch[]

  // Methods
  connect(): Promise<void>
  disconnect(): Promise<void>
  noteOn(noteNumber: number, velocity: number): void
  noteOff(noteNumber: number): void
  allNotesOff(): void
  loadPatch(patchId: string): Promise<void>
  loadPatchFromUrl(patch: CLAPPatch): Promise<void>
  setPatches(patches: CLAPPatch[]): void
  createGui(): Promise<HTMLElement>
  destroyGui(): Promise<void>
  dispose(): void

  // Capability checks
  hasAudioOutput(): boolean
  hasMidiOutput(): boolean
  hasAutomationOutput(): boolean
  hasMpeOutput(): boolean
  hasOscOutput(): boolean
  hasSysexOutput(): boolean
}
```

### CLAPRegistry

```typescript
class CLAPRegistry {
  static getInstance(): CLAPRegistry

  initialize(): Promise<void>
  addRegistry(registryUrl: string): Promise<void>
  removeRegistry(registryUrl: string): void
  getPatches(): CLAPPatch[]
  getPatchesByCategory(category: string): CLAPPatch[]
  getPatch(id: string): CLAPPatch | undefined
  searchPatches(query: string): CLAPPatch[]
  addPatch(patch: CLAPPatch): void
  removePatch(id: string): boolean
  clear(): void
  getCategories(): string[]
}
```

### CLAPPatch

```typescript
interface CLAPPatch {
  id: string
  name: string
  url: string
  category?: string
  description?: string
  author?: string
  version?: string
  factory?: string
}
```
