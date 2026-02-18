/**
 * IO Chain - Input, Transformation, Output
 * Handles audio routing, MIDI I/O, and signal processing
 */

// Input/Output Factories
export {
  createInputById,
  getAvailableInputFactories,
} from './input-factory.ts'

export {
  createOutputById,
  getAvailableOutputFactories,
} from './output-factory.ts'

// Input Manager
export {
  InputManager,
} from './input-manager.ts'

// Output Manager
export {
  OutputManager,
} from './output-manager.ts'

// IO Chain coordination
export {
  IOChain,
} from './IO-chain.ts'

// Transformer functionality
export {
  createTransformerById,
  getAvailableTransformers,
  getTransformerDefinitions,
} from './transformer-factory.ts'

export {
  TransformerManager,
} from './transformer-manager.ts'

export {
  TransformerManagerWorker,
} from './transformer-manager-worker.ts'

export {
  transformerDefinitions,
  getTransformerPresets,
} from './transformer-presets.ts'

// Sub-module exports
export * from './inputs/index.ts'
export * from './outputs/index.ts'
export * from './transformers/index.ts'
export * from './events/index.ts'
