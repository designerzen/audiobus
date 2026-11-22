# WebCLAP instruments and effects

[CLAPInstrument](clap-instrument.ts) hosts supported WebCLAP bundles through an AudioWorklet/WASM runtime. It does not load arbitrary native desktop CLAP binaries. Browser capability, served runtime assets and the particular plugin determine availability.

## Create an instrument

```ts
import { CLAPInstrument, clapRegistry } from "audiobus/instruments/clap/index.ts"

const context = new AudioContext()
await context.resume() // Enable audio from a user action.
const instrument = new CLAPInstrument(context, null, { routeAudio: true })
await instrument.connect()
console.log(instrument.availablePatches)
instrument.noteOn(60, 100)
instrument.noteOff(60)
document.body.append(await instrument.createGui())
// On teardown: instrument.allNotesOff(); await instrument.disconnect()
```

The constructor does not connect automatically. `connect()` initialises the registry and loads a default instrument patch. The optional second argument selects its patch ID; options include `defaultPatchId`, saved `parameters`, `mixer` and `routeAudio`. Without `routeAudio`, connect `instrument.output` through the host's audio routing. The host owns the context.

Use `loadPatch(id)` or `loadPatchFromUrl(patch)` to switch. A patch supplies `id`, `name`, `url` and appropriate `features` (such as `["instrument"]`); see [CLAPPatch](clap-types.ts). The constructor does not accept arbitrary DSP parameter options as top-level fields.

## Registry and assets

[The registry](clap-registry.ts) starts with the [built-in catalogue](clap-catalog.ts), then reads `<base>clap-registry.json`. It accepts an array or an object containing `patches`. `clapRegistry.addRegistry(url)` adds another source; `addPatch(patch)` adds metadata directly. Use actual plugin factory IDs/features.

[clap-host.ts](clap-host.ts) loads `<base>webclap/clap-audionode.mjs`; its runtime and bundle assets must be served. Plugin interfaces use [clap-ui.ts](clap-ui.ts). [clap-mixer.ts](clap-mixer.ts) manages a registered mixer rack for plugin audio effects; a MIDI transformer is a separate command processor.

Harmoneasy exposes instrument variants as `webclap:<plugin-id>` output IDs and also supports the `clap` instrument factory. [Output factories](../../io/output-factory.ts) and [instrument types](../instrument-types.ts) define their option handling. Use the app's live catalogue rather than assuming a default patch ID.

See [quick start](QUICKSTART.md), [source map](FILES.md) and [hosting requirements](CLAP.md).
