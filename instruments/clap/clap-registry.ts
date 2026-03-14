import type { CLAPPatch } from "./clap-types.ts"

/**
 * CLAP Registry Manager
 *
 * Manages loading and caching of available CLAP plugins from registries
 * Supports local and remote plugin registries
 */
export class CLAPRegistry {
	private static instance: CLAPRegistry
	private patches: Map<string, CLAPPatch> = new Map()
	private registryUrls: Set<string> = new Set()
	private initialized: boolean = false

	private constructor() {
		// Add default local registry
		this.registryUrls.add("/clap-registry.json")
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): CLAPRegistry {
		if (!CLAPRegistry.instance) {
			CLAPRegistry.instance = new CLAPRegistry()
		}
		return CLAPRegistry.instance
	}

	/**
	 * Initialize registry by fetching from configured sources
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			for (const registryUrl of this.registryUrls) {
				await this.loadRegistry(registryUrl)
			}
			this.initialized = true
		} catch (error) {
			console.error("[CLAPRegistry] Failed to initialize:", error)
			throw error
		}
	}

	/**
	 * Load patches from a registry JSON file
	 * @param registryUrl - URL to a JSON file containing patch definitions
	 */
	private async loadRegistry(registryUrl: string): Promise<void> {
		try {
			const response = await fetch(registryUrl)
			if (!response.ok) {
				console.warn(`[CLAPRegistry] Failed to load registry from ${registryUrl}:`, response.statusText)
				return
			}

			const data = (await response.json()) as { patches: CLAPPatch[] } | CLAPPatch[]
			const patches = Array.isArray(data) ? data : data.patches || []

			for (const patch of patches) {
				if (patch.id && patch.name && patch.url) {
					this.patches.set(patch.id, patch)
				}
			}

			console.log(`[CLAPRegistry] Loaded ${patches.length} patches from ${registryUrl}`)
		} catch (error) {
			console.error(`[CLAPRegistry] Error loading registry from ${registryUrl}:`, error)
		}
	}

	/**
	 * Add a custom registry URL
	 * @param registryUrl - URL to a JSON registry file
	 */
	async addRegistry(registryUrl: string): Promise<void> {
		this.registryUrls.add(registryUrl)
		await this.loadRegistry(registryUrl)
	}

	/**
	 * Remove a registry URL
	 */
	removeRegistry(registryUrl: string): void {
		this.registryUrls.delete(registryUrl)
	}

	/**
	 * Get all available patches
	 */
	getPatches(): CLAPPatch[] {
		return Array.from(this.patches.values())
	}

	/**
	 * Get patches by category
	 */
	getPatchesByCategory(category: string): CLAPPatch[] {
		return Array.from(this.patches.values()).filter((p) => p.category === category)
	}

	/**
	 * Get a specific patch by ID
	 */
	getPatch(id: string): CLAPPatch | undefined {
		return this.patches.get(id)
	}

	/**
	 * Search patches by name (case-insensitive)
	 */
	searchPatches(query: string): CLAPPatch[] {
		const lowerQuery = query.toLowerCase()
		return Array.from(this.patches.values()).filter(
			(p) =>
				p.name.toLowerCase().includes(lowerQuery) ||
				p.description?.toLowerCase().includes(lowerQuery) ||
				p.author?.toLowerCase().includes(lowerQuery)
		)
	}

	/**
	 * Add a patch to the registry
	 */
	addPatch(patch: CLAPPatch): void {
		this.patches.set(patch.id, patch)
	}

	/**
	 * Remove a patch from the registry
	 */
	removePatch(id: string): boolean {
		return this.patches.delete(id)
	}

	/**
	 * Clear all patches
	 */
	clear(): void {
		this.patches.clear()
		this.initialized = false
	}

	/**
	 * Get unique categories from all patches
	 */
	getCategories(): string[] {
		const categories = new Set<string>()
		for (const patch of this.patches.values()) {
			if (patch.category) {
				categories.add(patch.category)
			}
		}
		return Array.from(categories).sort()
	}
}

/**
 * Export singleton instance helper
 */
export const clapRegistry = CLAPRegistry.getInstance()

/**
 * Helper to initialize the registry
 */
export async function initializeCLAPRegistry(): Promise<void> {
	const registry = CLAPRegistry.getInstance()
	await registry.initialize()
}
