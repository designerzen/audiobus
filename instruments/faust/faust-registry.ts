/**
 * FAUST Registry
 * Manages available FAUST DSP modules
 */

import type { FAUSTDSPModule } from "./faust-types.ts"

class FAUSTRegistry {
	private modules: Map<string, FAUSTDSPModule> = new Map()
	private initialized: boolean = false

	/**
	 * Register a FAUST DSP module
	 */
	registerModule(module: FAUSTDSPModule): void {
		this.modules.set(module.id, module)
	}

	/**
	 * Get a module by ID
	 */
	getModule(id: string): FAUSTDSPModule | undefined {
		return this.modules.get(id)
	}

	/**
	 * Get all registered modules
	 */
	getModules(): FAUSTDSPModule[] {
		return Array.from(this.modules.values())
	}

	/**
	 * Get modules by category
	 */
	getModulesByCategory(category: string): FAUSTDSPModule[] {
		return Array.from(this.modules.values()).filter((m) => m.category === category)
	}

	/**
	 * Check if registry is initialized
	 */
	isInitialized(): boolean {
		return this.initialized
	}

	/**
	 * Mark registry as initialized
	 */
	setInitialized(): void {
		this.initialized = true
	}

	/**
	 * Clear all modules
	 */
	clear(): void {
		this.modules.clear()
		this.initialized = false
	}
}

// Global registry instance
export const faustRegistry = new FAUSTRegistry()

/**
 * Initialize the FAUST registry with default modules
 * This can be overridden to load modules from a server or configuration file
 */
export async function initializeFAUSTRegistry(): Promise<void> {
	if (faustRegistry.isInitialized()) {
		return
	}

	// Register example/default modules
	// These can be overridden or extended by the application
	faustRegistry.registerModule({
		id: "faust-sine",
		name: "Simple Sine Oscillator",
		description: "Basic sine wave oscillator with frequency and gain control",
		url: "/faust/dsp/sine.wasm",
		category: "oscillator",
		author: "FAUST",
		inputs: 0,
		outputs: 1,
		parameters: [
			{ name: "freq", min: 20, max: 20000, default: 440, step: 1 },
			{ name: "gain", min: 0, max: 1, default: 0.3, step: 0.01 }
		]
	})

	faustRegistry.registerModule({
		id: "faust-filter",
		name: "Lowpass Filter",
		description: "Simple lowpass filter with cutoff frequency control",
		url: "/faust/dsp/filter.wasm",
		category: "filter",
		author: "FAUST",
		inputs: 1,
		outputs: 1,
		parameters: [
			{ name: "cutoff", min: 20, max: 20000, default: 5000, step: 1 },
			{ name: "resonance", min: 0, max: 10, default: 1, step: 0.1 }
		]
	})

	faustRegistry.setInitialized()
}
