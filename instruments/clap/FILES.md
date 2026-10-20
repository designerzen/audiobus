# CLAP Instrument - File Structure

## Complete File Listing

All CLAP-related files are now consolidated in `packages/audiobus/instruments/clap/`

### Core Implementation Files

#### `clap-instrument.ts`
Main CLAP instrument class that implements `IAudioOutput` interface.

**Key Classes**:
- `CLAPInstrument` - Full-featured WASM-based synthesizer

**Key Methods**:
- `connect()` - Initialize, load registry, auto-load default patch
- `loadPatch(patchId)` - Load patch by ID from registry
- `loadPatchFromUrl(patch)` - Load patch from URL
- `noteOn(note, velocity)` - MIDI note on
- `noteOff(note)` - MIDI note off
- `allNotesOff()` - Release all notes
- `createGui()` - Generate patch selector GUI
- `destroyGui()` - Clean up GUI

**Properties**:
- `uuid` - Unique identifier
- `name` - Display name
- `description` - Current status description
- `isConnected` - Connection status
- `currentPatch` - Currently loaded patch
- `availablePatches` - Array of available patches

#### `clap-registry.ts`
Registry manager for CLAP plugins (singleton pattern).

**Key Classes**:
- `CLAPRegistry` - Manages patch discovery and loading

**Key Methods**:
- `initialize()` - Load registry from configured sources
- `getPatches()` - Get all available patches
- `getPatchesByCategory(category)` - Filter patches
- `getPatch(id)` - Get specific patch
- `searchPatches(query)` - Search by name/author/description
- `addRegistry(url)` - Add custom registry URL
- `addPatch(patch)` - Add patch programmatically
- `getCategories()` - Get unique categories

**Exports**:
- `clapRegistry` - Singleton instance
- `initializeCLAPRegistry()` - Initialize helper

#### `clap-types.ts`
Shared type definitions.

**Interfaces**:
- `CLAPPatch` - Plugin patch with metadata

#### `index.ts`
Module public API exports.

**Exports**:
- `CLAPInstrument` - Main class
- `CLAPPatch` - Type definition
- `CLAPRegistry` - Registry class
- `clapRegistry` - Registry singleton
- `initializeCLAPRegistry()` - Init helper

### Documentation Files

#### `README.md`
Complete usage guide with:
- Feature overview
- Quick start guide
- Plugin registry format
- CLAP bundle structure
- GUI customization
- Capability reference
- Lifecycle documentation
- Troubleshooting guide
- Full API reference
- Integration examples

#### `example.ts`
Code examples demonstrating:
1. Basic setup
2. Playing melodies
3. Patch selection
4. Custom default patches
5. GUI creation and display
6. Output manager integration
7. Polyphonic playing
8. Arpeggio patterns

### Configuration File

#### `public/clap-registry.json`
Example plugin registry with sample entries.

**Fields Per Patch**:
- `id` - Unique identifier
- `name` - Display name
- `url` - Plugin URL
- `category` - Plugin category
- `description` - Short description
- `author` - Plugin creator
- `version` - Plugin version
- `factory` - Factory ID (optional)

## Related Updated Files

### `packages/audiobus/instruments/instrument-types.ts`
**Changes**:
- Added `INSTRUMENT_TYPE_CLAP` constant
- Added CLAP to `INSTRUMENTS` registry
- Metadata includes auto-loading on creation

### `packages/audiobus/instruments/instrument-factory.ts`
**Changes**:
- Imported `INSTRUMENT_TYPE_CLAP`
- Added CLAP instantiation in `createInstrument()`
- Auto-connects and loads default patch

## Removed Files

The following were moved from `io/outputs/` to `instruments/clap/`:
- ~~output-clap.ts~~ → consolidated to `clap-instrument.ts`
- ~~clap-registry.ts~~ (old) → moved to `clap-registry.ts` (new)
- ~~CLAP.md~~ → moved to `README.md`
- ~~clap-example.ts~~ → moved to `example.ts`

Removed CLAP from:
- `packages/audiobus/io/outputs/output-types.ts` (removed CLAP constant)
- `packages/audiobus/io/output-definitions.ts` (removed CLAP definition)
- `packages/audiobus/io/output-factory.ts` (removed CLAP factory)
- `packages/audiobus/io/outputs/index.ts` (removed CLAP exports)

## File Sizes (Approximate)

| File | Size |
|------|------|
| clap-instrument.ts | 9 KB |
| clap-registry.ts | 4 KB |
| clap-types.ts | 1 KB |
| index.ts | 1 KB |
| README.md | 12 KB |
| example.ts | 8 KB |
| FILES.md | 3 KB |

**Total**: ~38 KB of implementation and documentation

## Dependencies

### Internal
- `../../io/outputs/output-interface.ts` - IAudioOutput interface
- `./clap-types.ts` - Type definitions
- `./clap-registry.ts` - Registry manager

### External (Web API)
- `WebAssembly` API - For loading WASM modules
- `Web Audio API` - AudioContext
- `Fetch API` - For loading plugins and registry
- `EventTarget` - For event dispatching

### No External NPM Dependencies
CLAP implementation uses only Web APIs - no additional npm packages required.

## Usage Path

```
User creates CLAP instrument
  ↓
InstrumentFactory.createInstrument(INSTRUMENT_TYPE_CLAP, audioContext)
  ↓
clap-instrument.ts: CLAPInstrument constructor
  ↓
CLAPInstrument.connect()
  ↓
initializeCLAPRegistry() loads /clap-registry.json
  ↓
clapRegistry.getPatches() gets available plugins
  ↓
loadPatchFromUrl() fetches and instantiates plugin
  ↓
ready for MIDI input (noteOn/noteOff)
```

## Integration Points

### Instruments Registry
CLAP is registered as an instrument type:
- Type ID: `"clap"`
- Category: `"synthesis"`
- Requires: `audioContext`
- Optional: `defaultPatchId` in options

### Outputs System
CLAP instruments work with:
- `OutputManager` - Routes MIDI to all outputs
- `IOChain` - Audio routing chains
- `Audio Graph UI` - Visual synthesis chains

### Factory Pattern
Created via:
- `InstrumentFactory.createInstrument()` - Recommended
- Direct instantiation with `new CLAPInstrument()`

## Extension Points

### Custom Registries
```typescript
clapRegistry.addRegistry('https://my-server.com/plugins.json')
```

### Programmatic Patches
```typescript
clapRegistry.addPatch({
  id: 'my-patch',
  name: 'My Plugin',
  url: '/plugins/my-plugin.wclap.tar.gz'
})
```

### Custom Default Patch
```typescript
InstrumentFactory.createInstrument(
  INSTRUMENT_TYPE_CLAP,
  audioContext,
  {},
  { defaultPatchId: 'my-favorite' }
)
```

### GUI Customization
Override `createGui()` to customize patch selector appearance.

## Build & Distribution

### Bundling
- CLAP files are dynamically imported via factory pattern
- Lazy-loaded only when instrument is created
- Tree-shaking friendly

### Distribution
- Can be published as part of audiobus package
- Self-contained module under `instruments/clap/`
- Zero additional npm dependencies

## Testing

Recommended test coverage:
- Registry initialization and patch loading
- Patch switching
- MIDI note input (noteOn/noteOff)
- GUI creation and interaction
- WASM module loading errors
- Multiple instance creation
- Memory cleanup on dispose
