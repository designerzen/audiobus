# CLAP Instrument

A Web-based CLAP (Common Language Audio Plugin) synthesizer instrument that automatically loads plugins from a registry with minimal configuration.

## Features

✅ **Zero-Config Initialization** - Automatically loads registry and default patch on creation  
✅ **Smart Patch Selection** - GUI with categorized patch selector organized by plugin type  
✅ **Automatic Registry Loading** - Loads `/clap-registry.json` automatically  
✅ **MIDI-Compatible** - Full noteOn/noteOff support with velocity  
✅ **Plugin Switching** - Switch patches without interrupting playback  
✅ **Visual Feedback** - Status indicators and plugin metadata display  

## Quick Start

### 1. Create Registry File

Place `clap-registry.json` in your `public/` directory:

```json
{
  "patches": [
    {
      "id": "my-synth-v1",
      "name": "My Synth",
      "url": "/clap-plugins/my-synth.wclap.tar.gz",
      "category": "Synthesis",
      "description": "A custom synthesizer",
      "author": "Your Name",
      "version": "1.0.0"
    }
  ]
}
```

### 2. Create Instrument

```typescript
import { InstrumentFactory, INSTRUMENT_TYPE_CLAP } from '@audiobus/instruments'

const clap = await InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext
)

// Already connected and loaded default patch!
```

### 3. Play Notes

```typescript
// Note on (MIDI note 60 = C4, velocity 100)
clap.noteOn(60, 100)

// Note off
clap.noteOff(60)

// Release all notes
clap.allNotesOff()
```

### 4. Add GUI

```typescript
const gui = await clap.createGui()
document.getElementById('controls').appendChild(gui)

// Users can select different patches from the dropdown
```

## Usage Examples

### With Custom Default Patch

```typescript
const clap = await InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext,
  {}, // externalData (empty for CLAP)
  { defaultPatchId: 'my-favorite-synth' } // options
)
```

### Programmatic Patch Loading

```typescript
// Get current patch
console.log(clap.currentPatch?.name)

// List available patches
clap.availablePatches.forEach(patch => {
  console.log(`${patch.name} (${patch.id})`)
})

// Load a specific patch
await clap.loadPatch('another-synth-id')
```

### In an Output Manager

```typescript
import OutputManager from '@audiobus/io/output-manager'

const outputManager = new OutputManager()
outputManager.add(clap)

// Now CLAP receives all notes
clap.noteOn(60, 100)
outputManager.noteOn(60, 100) // routes to all outputs including CLAP
```

## Plugin Registry Format

### Registry Structure

Create `public/clap-registry.json`:

```json
{
  "patches": [
    {
      "id": "unique-plugin-id",
      "name": "Display Name",
      "url": "/path/to/plugin.wclap.tar.gz",
      "category": "Synthesis|Effects|Utility|etc",
      "description": "Optional description",
      "author": "Plugin author",
      "version": "1.0.0",
      "factory": "optional-factory-id"
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the patch |
| `name` | string | Display name in patch selector |
| `url` | string | URL to `.wclap` or `.tar.gz` file |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | Plugin category (used for grouping) |
| `description` | string | Short description |
| `author` | string | Plugin creator |
| `version` | string | Plugin version |
| `factory` | string | Factory ID within plugin |

## CLAP Plugin Bundle Format

CLAP plugins should follow this directory structure:

```
my-plugin.wclap/
├── module.wasm          # Compiled WebAssembly module
├── manifest.json        # Plugin metadata
├── factory-presets/     # Optional: Factory presets
│   ├── preset1.txt
│   └── preset2.txt
├── gui/                 # Optional: Web-based UI
│   ├── index.html
│   ├── style.css
│   └── script.js
└── resources/           # Optional: Additional files
```

### Creating a Distribution Bundle

```bash
# Package as tar.gz for web distribution
tar czf my-plugin.wclap.tar.gz my-plugin.wclap/

# Serve with proper Content-Type: application/gzip
```

## GUI Customization

The built-in GUI provides:

- **Status Indicator** - Shows connection/loading state
- **Current Patch Info** - Name, description, author
- **Patch Selector** - Dropdown organized by category
- **Category Summary** - Number of available plugins

### Create GUI

```typescript
const guiElement = await clap.createGui()
container.appendChild(guiElement)
```

### Destroy GUI

```typescript
await clap.destroyGui()
guiElement.remove()
```

## Capabilities

CLAP instruments support the following capabilities:

```typescript
clap.hasAudioOutput()      // true - produces audio
clap.hasMidiOutput()       // false - doesn't send MIDI
clap.hasAutomationOutput() // true - parameter automation capable
clap.hasMpeOutput()        // true - supports MPE (MIDI Polyphonic Expression)
clap.hasOscOutput()        // false - no OSC support
clap.hasSysexOutput()      // true - can handle SysEx
```

## Lifecycle

```typescript
// Creation
const clap = await InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext
)
// Already connected and patch loaded at this point

// Usage
clap.noteOn(60, 100)
clap.noteOff(60)

// Patch switching
await clap.loadPatch('other-synth-id')

// Cleanup
await clap.disconnect()
clap.dispose()
```

## Troubleshooting

### No patches loading

**Problem**: Dropdown shows "No patches available"

**Solution**:
- Check that `public/clap-registry.json` exists
- Verify JSON format is valid (`npm run format`)
- Check browser console for fetch errors
- Ensure server is configured to serve JSON with correct Content-Type

### Plugin won't play

**Problem**: Notes don't produce sound

**Solution**:
- Confirm `isConnected` returns `true`
- Check that `currentPatch` is not null
- Verify audio context is running (`audioContext.state === "running"`)
- Check browser console for WebAssembly errors

### Patch switching fails

**Problem**: Error when loading new patch

**Solution**:
- Verify patch ID exists in registry
- Check that patch URL is accessible
- Ensure WebAssembly file format is correct
- Try with a different patch to isolate issue

## API Reference

### CLAPInstrument Class

```typescript
class CLAPInstrument implements IAudioOutput {
  // Properties
  uuid: string
  name: string
  description: string
  isConnected: boolean
  isHidden: boolean
  currentPatch: CLAPPatch | null
  availablePatches: CLAPPatch[]

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  dispose(): void

  // Note control
  noteOn(noteNumber: number, velocity: number): void
  noteOff(noteNumber: number): void
  allNotesOff(): void

  // Patch management
  loadPatch(patchId: string): Promise<void>
  loadPatchFromUrl(patch: CLAPPatch): Promise<void>

  // GUI
  createGui(): Promise<HTMLElement>
  destroyGui(): Promise<void>

  // Capabilities
  hasAudioOutput(): boolean
  hasMidiOutput(): boolean
  hasAutomationOutput(): boolean
  hasMpeOutput(): boolean
  hasOscOutput(): boolean
  hasSysexOutput(): boolean
}
```

### CLAPPatch Type

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

## Integration with harmoneasy

### Using with IO Chain

```typescript
import { IOChain } from '@audiobus/io'

const chain = new IOChain(audioContext)

// Add CLAP as a synthesis instrument
const clap = await InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext
)

chain.addInput(midiInput)
chain.addInstrument(clap)
chain.addOutput(audioOutput)
```

### Using with Audio Graph

CLAP instruments appear as synthesizer nodes in the audio graph UI, allowing users to:
- Add multiple CLAP instances with different patches
- Route different tracks to different CLAP plugins
- Arrange them in any order in the synthesis chain

## Performance Considerations

- **WebAssembly Performance**: CLAP plugins run as native WebAssembly, providing near-native performance
- **Registry Loading**: Registry loads on-demand and caches patches
- **Memory**: Each CLAP instance loads its own plugin copy; consider memory with many instances
- **Latency**: Minimal latency comparable to native plugins

## Browser Support

Required:
- **WebAssembly**: All modern browsers (Chrome 74+, Firefox 79+, Safari 14.1+, Edge 79+)
- **Web Audio API**: Standard in all modern browsers
- **AudioContext**: Global audio context support

Optional:
- **AudioWorklet**: For advanced processing (future enhancement)

## References

- [CLAP Specification](https://github.com/free-audio/clap)
- [Web CLAP Specification](https://github.com/free-audio/web-clap)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
