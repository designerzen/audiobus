# IOChain export and import

[IOChain](IO-chain.ts) exposes `exportString()`, `importString(encoded, options?)`, `exportTransformers()` and `importTransformers(config, options?)`.

## Chain snapshots

`exportString()` returns LZ-string `compressToBase64(JSON.stringify(data))`, not base64url. It can contain `+`, `/` and `=`; encode it with `URLSearchParams` if transporting it in a URL. Harmoneasy does not define the former example's `/playback?state=` route.

The version-1 snapshot includes chain options, transformer-manager data, timer BPM/running state/position and queued commands. It does **not** include input/output device definitions, connections, samples, plugin binaries or runtime permissions. Importing a snapshot alone does not recreate an audible instrument setup.

```ts
import IOChain from "audiobus/io/IO-chain.ts"

const snapshot = sourceChain.exportString()
const restored = new IOChain(timer)
restored.importString(snapshot, { name: "Restored chain" })
// Attach the intended input/output devices and wire host timer updates separately.
```

`importString` validates the snapshot version, restores transformer data, applies the saved timer state and restores the queue. It can start or stop the shared timer. Invalid input throws an `Invalid IOChain export string` error. Option overrides follow current options, saved options, then supplied options.

## Complete workspaces and portable projects

[IOChainManager](IO-chain-manager.ts) supplies `exportWorkspace()`, `exportWorkspaceData()` and asynchronous `restoreWorkspace(encoded)`. Encoded workspaces begin with `workspace:`; version-2 workspace data records shared devices and chain connections.

[Project bundles](project-bundle.ts) add a portable manifest and attached files, with explicit dependencies and exclusions. The app's versioned preset URL API uses a separate `harmoneasy-preset` page containing workspace data, clock settings and MIDI controls. A chain snapshot, encoded workspace, bundle and preset page are distinct formats.

For transformer-only imports and overrides see [Import options](IMPORT_OPTIONS.md). Read the [package overview](../README.md#recording-import-export-and-persistence) for persistence and format adapters.
