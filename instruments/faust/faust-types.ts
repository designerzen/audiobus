/**
 * FAUST Types
 * Shared type definitions for FAUST DSP modules
 */

/**
 * FAUST DSP metadata
 * Represents a compiled FAUST DSP module with its metadata
 */
export interface FAUSTDSPModule {
	id: string
	name: string
	url: string // URL to the .wasm file or bundle
	category?: string
	description?: string
	author?: string
	version?: string
	inputs?: number // Number of audio inputs
	outputs?: number // Number of audio outputs
	parameters?: FAUSTParameter[]
}

/**
 * FAUST Parameter
 * Metadata for a FAUST DSP parameter
 */
export interface FAUSTParameter {
	name: string
	min: number
	max: number
	default: number
	step?: number
}

/**
 * FAUST DSP Instance
 * Represents an instantiated FAUST DSP processor
 */
export interface FAUSTDSPInstance {
	memory: WebAssembly.Memory
	instance: WebAssembly.Instance
	inputBuffers: Float32Array[]
	outputBuffers: Float32Array[]
	parameterPointers: Map<string, number>
	sampleRate: number
	blockSize: number
}
