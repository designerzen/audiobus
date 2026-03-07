# IOChain Import Options

## Overview

Added optional `options` parameter to import methods for passing configuration data during state restoration.

## Methods Updated

### importString(encodedString: string, options?: Record<string, any>)

Import chain state from an export string with optional configuration.

```typescript
const chain = new IOChain(timer)

// Without options
chain.importString(exportedString)

// With options
chain.importString(exportedString, {
    customKey: 'customValue',
    metadata: { source: 'url', timestamp: Date.now() }
})
```

**Parameters**:
- `encodedString`: URL-safe export string from `exportString()`
- `options` (optional): Configuration to merge with restored state

**Option Merging Order**:
1. Current chain options
2. Exported data options
3. Passed options (highest priority)

```typescript
// Example: Exported string has option A=1, B=2
// Passed options are A=10, C=30
// Result: A=10, B=2, C=30
this.#options = { 
    ...this.#options,           // Current state
    ...data.options,            // From export
    ...options                  // Passed options (override)
}
```

### importTransformers(configString: string, options?: Record<string, any>)

Import transformer configurations with optional settings.

```typescript
// Without options
chain.importTransformers(transformerConfig)

// With options - metadata, processing hints, etc.
chain.importTransformers(transformerConfig, {
    skipValidation: true,
    preserveState: true,
    context: { source: 'preset', name: 'minimal' }
})
```

**Parameters**:
- `configString`: JSON string from `exportTransformers()`
- `options` (optional): Configuration to merge into chain options

## Use Cases

### 1. Pass Metadata During Import

```typescript
const chain = new IOChain(timer)

chain.importString(exportedString, {
    importedAt: new Date().toISOString(),
    importedFrom: 'user-file',
    importerId: 'user-123'
})

// Later, access the metadata
const metadata = chain.options
// { importedAt: "...", importedFrom: "...", importerId: "..." }
```

### 2. Override Settings During Import

```typescript
// Export has one setting, override on import
chain.importString(exportedString, {
    autoPlay: true,      // Override exported setting
    volume: 0.5,         // Add new setting
    skipMIDI: true       // Control behavior
})
```

### 3. Pass Context Information

```typescript
const chain = await importStringInputOutputChain(
    exportedString,
    bus.mixer,
    [],
    [ui]
)

// After import, set context
chain.importString(exportedString, {
    context: {
        scene: 'main',
        preset: 'ambient',
        version: '1.0'
    },
    tags: ['ambient', 'relaxing', 'tutorial']
})
```

### 4. Conditional Import Logic

```typescript
const options = {
    autoConnect: false,
    retryFailed: true,
    timeout: 5000
}

if (userIsOffline) {
    options.offlineMode = true
}

chain.importString(exportedString, options)
```

### 5. Constructor Layout with Options

```typescript
const chain = new IOChain(timer, {
    layout: exportedString,
    metadata: { restored: true },
    onRestore: () => console.log('Restored!')
})

// All options are merged and available
```

## Option Merging Examples

### Example 1: Simple Merge

```typescript
// Exported state has: { quantize: true, bpm: 120 }
chain.importString(exported, { 
    quantize: false,      // Override
    newOption: 'value'    // Add new
})

// Result: { quantize: false, bpm: 120, newOption: 'value' }
```

### Example 2: Deep Nesting

```typescript
// Exported: { config: { a: 1, b: 2 } }
chain.importString(exported, {
    config: { a: 10 }     // Note: this replaces entire config object
})

// Result: { config: { a: 10 } } ← b is lost (shallow merge)
// For deep merge, use: { ...currentOptions, ...passedOptions }
```

### Example 3: Metadata

```typescript
const options = {
    // Control settings
    skipValidation: true,
    lazy: true,
    
    // Metadata
    source: 'cloud-storage',
    userId: 'user-456',
    timestamp: Date.now(),
    
    // Feature flags
    enableDebug: true,
    experimentalFeatures: ['ai-completion']
}

chain.importString(exportedString, options)
```

## Constructor Integration

The `IOChainOptions` interface supports options:

```typescript
interface IOChainOptions {
    layout?: string | null
    // Any other options
    [key: string]: any
}

// Constructor merges layout and other options
const chain = new IOChain(timer, {
    layout: exportedString,
    customSetting: 'value',
    metadata: { ... }
})
```

## Accessing Options After Import

Options are stored in the chain and accessible:

```typescript
chain.importString(exportedString, {
    importedAt: Date.now(),
    source: 'url'
})

// Later access
const options = chain.options
console.log(options.importedAt)  // ✅ Available
console.log(options.source)      // ✅ Available
```

## Error Handling

Options are optional - import always works:

```typescript
// Both valid
chain.importString(exported)              // No options
chain.importString(exported, { a: 1 })    // With options

// Options don't affect restoration
try {
    chain.importString(exported, { invalid: true })
    // Still imports successfully, options are merged
} catch (error) {
    // Only throws if export string is invalid
    console.error('Export string error:', error)
}
```

## Common Option Patterns

### Logging/Debugging

```typescript
chain.importString(exported, {
    debug: true,
    logLevel: 'info',
    traceImport: true
})
```

### Behavior Control

```typescript
chain.importString(exported, {
    autoStart: false,
    autoConnect: true,
    skipValidation: false
})
```

### Source Tracking

```typescript
chain.importString(exported, {
    importSource: 'user-file',
    importedBy: userId,
    importedAt: new Date(),
    originalName: filename
})
```

### Feature Flags

```typescript
chain.importString(exported, {
    features: {
        quantization: true,
        automation: true,
        aiSuggestions: false
    }
})
```

## Type Safety

Options are typed as `Record<string, any>` for flexibility:

```typescript
// Valid - any key/value
chain.importString(exported, {
    any: 'value',
    number: 123,
    object: { nested: true },
    array: [1, 2, 3]
})
```

## Best Practices

1. **Keep Options Serializable**
   ```typescript
   // ✅ Good
   chain.importString(exported, { 
       timestamp: Date.now(),
       name: 'preset'
   })
   
   // ❌ Avoid functions/non-serializable
   chain.importString(exported, { 
       callback: () => {},  // Can't be serialized
       dom: element         // Can't be serialized
   })
   ```

2. **Use Namespaces for Organization**
   ```typescript
   // Better than flat structure
   chain.importString(exported, {
       metadata: { userId, timestamp },
       settings: { autoPlay, volume },
       features: { debug, experimental }
   })
   ```

3. **Document Custom Options**
   ```typescript
   // Comment what options your code uses
   chain.importString(exported, {
       // Custom app options
       appVersion: '2.0',
       theme: 'dark',
       uiMode: 'advanced'
   })
   ```

## Migration Guide

### Before
```typescript
chain.importString(exported)
// No way to pass configuration
```

### After
```typescript
chain.importString(exported, {
    metadata: { imported: true },
    settings: { autoPlay: true }
})
```

## Related Methods

- `exportString()` - Create export string
- `importTransformers(config, options)` - Import with options
- Constructor with `layout` option - Restore in constructor
- `options` getter - Access current options

## Summary

Options parameter provides:
- ✅ Flexible configuration during import
- ✅ Metadata passing
- ✅ Override exported settings
- ✅ Feature flags and control flow
- ✅ Fully backward compatible
