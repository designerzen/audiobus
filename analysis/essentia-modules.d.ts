// essentia.js ships no typings for its ES builds.
declare module "essentia.js/dist/essentia-wasm.es.js" {
	export const EssentiaWASM: {
		calledRun?: boolean
		onRuntimeInitialized?: () => void
		[key: string]: unknown
	}
}

declare module "essentia.js/dist/essentia.js-core.es.js" {
	export default class Essentia {
		constructor(wasm: unknown, isDebug?: boolean)
		version: string
		arrayToVector(array: Float32Array | number[]): EssentiaVector
		vectorToArray(vector: EssentiaVector): Float32Array
		[algorithm: string]: any
	}
}

interface EssentiaVector {
	size(): number
	get(index: number): number
	delete(): void
}