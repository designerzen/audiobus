/**
 * IO Chain - Input, Transformation, Output
 * Handles audio routing, MIDI I/O, and signal processing
 */

// Input/Output Factories
export { createInputById, getAvailableInputFactories } from "./input-factory.ts"

export { createOutputById, getAvailableOutputFactories } from "./output-factory.ts"

// Input Manager
export { default as InputManager } from "./input-manager.ts"

// Output Manager
export { default as OutputManager } from "./output-manager.ts"

// IO Chain coordination
export { default as IOChain } from "./IO-chain.ts"

// Transformer functionality
export { tranformerFactory, TRANSFORMER_TYPE, TRANSFORMERS } from "./transformer-factory.ts"

export { default as TransformerManager } from "./transformer-manager.ts"

export { default as TransformerManagerWorker } from "./transformer-manager-worker.ts"

export {
	DEFAULT_PRESET_LIBRARY,
	PRESETS,
	PRESET_CATEGORIES,
	createPresetTransformers,
	type PresetStep,
	type TransformerPreset
} from "./transformer-presets.ts"

// Definitions and metadata
export * from "./definitions-index.ts"
export {
	INPUT_DEFINITIONS,
	getInputDefinition,
	getInputIcon,
	getInputsByCategory,
	type InputDefinition
} from "./input-definitions.ts"

export {
	OUTPUT_DEFINITIONS,
	getOutputDefinition,
	getOutputIcon,
	getOutputsByCategory,
	type OutputDefinition
} from "./output-definitions.ts"

export {
	TRANSFORMER_DEFINITIONS,
	getTransformerDefinition,
	getTransformerIcon,
	getTransformersByCategory,
	type TransformerDefinition
} from "./transformer-definitions.ts"

// Sub-module exports
export * from "./inputs/index.ts"
export * from "./outputs/index.ts"
export * from "./transformers/index.ts"
export * from "./events/index.ts"