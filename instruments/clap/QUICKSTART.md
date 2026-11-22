# WebCLAP quick start

Use [the instrument guide](README.md#create-an-instrument) for the current example and exact constructor. Import `CLAPInstrument` from `audiobus/instruments/clap/index.ts`, construct it with a user-enabled AudioContext, and await `connect()`. The former `@audiobus/instruments` import is not the package name.

Choose an ID from `availablePatches` before calling `loadPatch(id)`. For custom metadata, use `clapRegistry.addPatch(patch)` or `await clapRegistry.addRegistry(url)`; instrument entries need appropriate features and a browser-compatible bundle.

Serve the runtime and plugin assets described in [hosting requirements](CLAP.md). MIDI notes require an instrument output route; choosing a patch alone does not configure an external MIDI port. Release held notes and disconnect the plugin when removing it.
