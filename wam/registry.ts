/**
 * WAM2 Registry Manager
 * 
 * Manages fetching and caching the WAM2 community plugin registry
 * Provides discovery, filtering, and metadata for available WAM2 plugins
 * 
 * Registry source: https://www.webaudiomodules.com/community/plugins.json
 */

export interface WAM2PluginDescriptor {
	identifier: string
	name: string
	vendor: string
	website?: string
	description: string
	keywords: string[]
	category: string[]
	thumbnail?: string
	thumbnailDimensions?: {
		width: number
		height: number
	}
	path: string // path to index.js on webaudiomodules.com
}

export class WAM2Registry {
	private static readonly REGISTRY_URL = "https://www.webaudiomodules.com/community/plugins.json"
	private static readonly BASE_URL = "https://www.webaudiomodules.com/community/"
	private static instance: WAM2Registry
	private plugins: WAM2PluginDescriptor[] = []
	private initialized: boolean = false
	private initPromise: Promise<void> | null = null

	private constructor() {}

	static getInstance(): WAM2Registry {
		if (!WAM2Registry.instance) {
			WAM2Registry.instance = new WAM2Registry()
		}
		return WAM2Registry.instance
	}

	/**
	 * Initialize the registry by fetching plugins from the online registry
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return
		if (this.initPromise) return this.initPromise

		this.initPromise = this.fetchRegistry()
		await this.initPromise
		this.initialized = true
	}

	private async fetchRegistry(): Promise<void> {
		try {
			const response = await fetch(WAM2Registry.REGISTRY_URL)
			if (!response.ok) {
				throw new Error(`Failed to fetch WAM2 registry: ${response.statusText}`)
			}

			const data = await response.json()
			this.plugins = Array.isArray(data) ? data : data.plugins || []
			
			console.info(`Loaded ${this.plugins.length} WAM2 plugins from registry`)
		} catch (error) {
			console.error("Failed to fetch WAM2 registry:", error)
			this.plugins = []
			throw error
		}
	}

	/**
	 * Get all available plugins
	 */
	getAll(): WAM2PluginDescriptor[] {
		return [...this.plugins]
	}

	/**
	 * Get a plugin by identifier
	 */
	getById(identifier: string): WAM2PluginDescriptor | undefined {
		return this.plugins.find(p => p.identifier === identifier)
	}

	/**
	 * Filter plugins by category
	 */
	getByCategory(category: string): WAM2PluginDescriptor[] {
		return this.plugins.filter(p => 
			p.category.some(c => c.toLowerCase() === category.toLowerCase())
		)
	}

	/**
	 * Get instrument/synth plugins only
	 */
	getInstruments(): WAM2PluginDescriptor[] {
		return this.getByCategory("Instrument")
	}

	/**
	 * Get effect plugins
	 */
	getEffects(): WAM2PluginDescriptor[] {
		return this.getByCategory("Effect")
	}

	/**
	 * Get utility plugins
	 */
	getUtilities(): WAM2PluginDescriptor[] {
		return this.getByCategory("Utility")
	}

	/**
	 * Search plugins by text (name, vendor, keywords, description)
	 */
	search(query: string): WAM2PluginDescriptor[] {
		const term = query.toLowerCase()
		return this.plugins.filter(p =>
			p.name.toLowerCase().includes(term) ||
			p.vendor.toLowerCase().includes(term) ||
			p.description.toLowerCase().includes(term) ||
			p.keywords.some(k => k.toLowerCase().includes(term))
		)
	}

	/**
	 * Get the full URL for a plugin's index.js
	 */
	getPluginUrl(plugin: WAM2PluginDescriptor): string {
		return `${WAM2Registry.BASE_URL}${plugin.path}`
	}

	/**
	 * Get the full URL for a plugin's thumbnail
	 */
	getThumbnailUrl(plugin: WAM2PluginDescriptor): string | null {
		if (!plugin.thumbnail) return null
		return `${WAM2Registry.BASE_URL}${plugin.thumbnail}`
	}

	/**
	 * Get plugins grouped by category
	 */
	getGroupedByCategory(): Map<string, WAM2PluginDescriptor[]> {
		const grouped = new Map<string, WAM2PluginDescriptor[]>()
		
		this.plugins.forEach(plugin => {
			plugin.category.forEach(cat => {
				if (!grouped.has(cat)) {
					grouped.set(cat, [])
				}
				grouped.get(cat)!.push(plugin)
			})
		})

		// Sort each group by name
		grouped.forEach(plugins => {
			plugins.sort((a, b) => a.name.localeCompare(b.name))
		})

		return grouped
	}
}

export default WAM2Registry.getInstance()
