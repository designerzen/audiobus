# WebCLAP source map

| File | Responsibility |
| --- | --- |
| [index.ts](index.ts) | Public class, registry and patch-type exports. |
| [clap-instrument.ts](clap-instrument.ts) | Explicit connect/disconnect, patch switching, MIDI note delivery, parameters and GUI. |
| [clap-types.ts](clap-types.ts) | Patch IDs, bundle URLs, factories, features and attribution. |
| [clap-catalog.ts](clap-catalog.ts) | Built-in plugin metadata. |
| [clap-registry.ts](clap-registry.ts) | Catalogue merging and optional JSON registry loading. |
| [clap-host.ts](clap-host.ts) | Runtime URL resolution and worklet-host node creation. |
| [clap-ui.ts](clap-ui.ts) | Plugin interface resources and lifecycle. |
| [clap-mixer.ts](clap-mixer.ts) | Registered mixer racks and plugin effect insertion/removal. |

See [README](README.md) for current usage. The old file inventory described methods and automatic initialization that differed from the implementation.
