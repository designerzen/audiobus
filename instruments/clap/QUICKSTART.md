# CLAP Instrument - Quick Start

## 30-Second Setup

### 1. Add Registry File
Create `public/clap-registry.json`:
```json
{
  "patches": [
    {
      "id": "my-synth",
      "name": "My Synth",
      "url": "/clap-plugins/my-synth.wclap.tar.gz",
      "category": "Synthesis"
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
// Done! Auto-connected with default patch loaded.
```

### 3. Play Notes
```typescript
clap.noteOn(60, 100)   // Play note
clap.noteOff(60)       // Stop note
```

### 4. Show GUI (Optional)
```typescript
const gui = await clap.createGui()
container.appendChild(gui)
```

---

## Common Tasks

### Load Different Patch
```typescript
await clap.loadPatch('other-synth-id')
```

### List All Patches
```typescript
clap.availablePatches.forEach(p => {
  console.log(p.name, '-', p.category)
})
```

### Add Custom Registry
```typescript
import { clapRegistry } from '@audiobus/instruments/clap'

await clapRegistry.addRegistry(
  'https://plugins.example.com/registry.json'
)
```

### Use with Output Manager
```typescript
import OutputManager from '@audiobus/io/output-manager'

const manager = new OutputManager()
manager.add(clap)

// Notes route to CLAP automatically
manager.noteOn(60, 100)
```

### Specify Default Patch
```typescript
const clap = await InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext,
  {},
  { defaultPatchId: 'my-favorite-synth' }
)
```

### Clean Up
```typescript
await clap.disconnect()
clap.dispose()
```

---

## API Cheat Sheet

```typescript
// Initialization
const clap = await InstrumentFactory.createInstrument(INSTRUMENT_TYPE_CLAP, ctx)

// Properties
clap.isConnected          // boolean
clap.currentPatch         // CLAPPatch | null
clap.availablePatches     // CLAPPatch[]
clap.name                 // string
clap.description          // string

// MIDI Control
clap.noteOn(noteNum, velocity)
clap.noteOff(noteNum)
clap.allNotesOff()

// Patch Management
await clap.loadPatch(patchId)
await clap.loadPatchFromUrl(patchObj)

// GUI
const gui = await clap.createGui()
await clap.destroyGui()

// Lifecycle
await clap.connect()
await clap.disconnect()
clap.dispose()

// Capabilities
clap.hasAudioOutput()      // true
clap.hasMidiOutput()       // false
clap.hasAutomationOutput() // true
clap.hasMpeOutput()        // true
```

---

## Registry JSON Format

```json
{
  "patches": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "url": "/path/to/plugin.wclap.tar.gz",
      "category": "Synthesis",
      "description": "Optional description",
      "author": "Author Name",
      "version": "1.0.0"
    }
  ]
}
```

**Required Fields**: `id`, `name`, `url`  
**Optional Fields**: `category`, `description`, `author`, `version`, `factory`

---

## File Structure

```
Your Project/
├── public/
│   ├── clap-registry.json           # Plugin list
│   └── clap-plugins/
│       ├── my-synth.wclap.tar.gz
│       └── my-effect.wclap.tar.gz
├── src/
│   └── audio.ts
└── package.json
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No patches showing | Check `public/clap-registry.json` exists |
| Plugin won't play | Verify `isConnected === true` |
| GUI not showing | Call `createGui()` and append to DOM |
| Can't find patch | Check patch ID exists in registry |
| WASM error | Ensure plugin URL is correct and accessible |

---

## Full Documentation

See `README.md` for complete documentation, including:
- Advanced usage patterns
- Plugin bundle format
- Performance considerations
- Browser compatibility
- Custom registry management
- Lifecycle examples
- Error handling
- Integration guides

---

## Examples

See `example.ts` for code examples:
1. Basic setup
2. Play melody
3. Patch selection
4. Custom defaults
5. GUI creation
6. Output manager
7. Polyphonic playing
8. Arpeggio patterns

---

## Key Features

✨ **Zero Configuration** - Works immediately with auto-loading  
✨ **Smart GUI** - Patch selector with metadata display  
✨ **Full MIDI** - Complete note control with velocity  
✨ **Hot Patching** - Switch patches without stopping playback  
✨ **Registry Management** - Add/search/filter plugins  
✨ **Event-Driven** - Listen for load/connect events  

---

## Support

For issues:
1. Check browser console for errors
2. Verify `clap-registry.json` format
3. Confirm plugin URLs are accessible
4. Check WebAssembly is supported
5. See README.md troubleshooting section

For development:
1. Read `clap-instrument.ts` implementation
2. Study registry manager in `clap-registry.ts`
3. Review type definitions in `clap-types.ts`
4. Check examples in `example.ts`
