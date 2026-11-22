# FAUST instrument prototype

[index.ts](index.ts) exports `FAUSTInstrument`, `faustRegistry`, `initializeFAUSTRegistry` and DSP metadata types. Use `audiobus/instruments/faust/index.ts` with a TypeScript-aware browser bundler.

The current [instrument](faust-instrument.ts) is a prototype. `loadModule(id)` fetches the registered URL and records its metadata, but does not instantiate or execute that WASM. Its `FAUSTVoice` synthesises a placeholder sine/envelope signal; `setParameter` is a stub. It uses a ScriptProcessorNode and does not provide production FAUST DSP hosting or reliable dynamic parameter control.

## Current API

`new FAUSTInstrument(audioContext, defaultModuleId?)` constructs the adapter; the second argument is currently unused. Call `connect()` and explicitly `loadModule(id)` before notes. `noteOn`, `noteOff`, `allNotesOff` and `disconnect` provide the prototype lifecycle. It connects to the context destination directly.

[faust-registry.ts](faust-registry.ts) manages module metadata and installs the example `faust-sine` and `faust-filter` entries on initialization. Those URLs still require host-served assets. [faust-types.ts](faust-types.ts) defines the metadata contract.

For playable hosted FAUST instruments, audiobus also has WAM2 plugin entries; see [WAM registry](../../wam/registry.ts) and [instrument registry](../instrument-types.ts). That plugin hosting path is separate from this prototype.
