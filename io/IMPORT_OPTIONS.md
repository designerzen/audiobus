# IOChain import options

See [IOChain](IO-chain.ts) and [export/import formats](EXPORT_IMPORT.md) for the current contracts.

`importString(encoded, options?)` decompresses the version-1 chain snapshot and merges options in this order:

1. Current chain options.
2. Saved snapshot options.
3. Supplied options, which take precedence.

It also restores transformer data, timer state and queued commands. It does not create input/output devices or restore their connections.

`importTransformers(configString, options?)` consumes the JSON configuration produced by `exportTransformers()`, recreates the transformer pipeline, and shallowly merges supplied options into the **chain** options. Those options are not a transformer import policy or a device factory configuration.

```ts
const configuration = sourceChain.exportTransformers()
targetChain.importTransformers(configuration, { name: "Alternate voice" })
```

Arbitrary properties may be stored in chain options, but names such as `skipValidation`, `preserveState` and `autoPlay` do not implement behavior merely because they are present. Use actual component fields and APIs for processing, playback and runtime resources. Invalid transformer configurations throw an `Invalid transformer config` error.

For devices, independent parts and shareable presets, use the workspace and preset-page APIs described in [the package README](../README.md#recording-import-export-and-persistence).
