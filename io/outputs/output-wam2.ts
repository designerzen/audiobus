import { NOTE_ON } from '../../commands'
import wam2Registry from "../../wam/registry.ts"

import type { IAudioOutput } from "./output-interface.ts"
import type { WAM2PluginDescriptor } from "../../wam/registry.ts"

/**
 * Web Audio Modules 2 (WAM2) Audio Output
 * 
 * Enables integration with WAM2 audio plugins as synthesizers and instruments.
 * WAM2 plugins are Web Audio API nodes that can be connected to the audio graph
 * and controlled via MIDI-like messages (noteOn, noteOff).
 * 
 * Features:
 * - Load WAM2 plugins from online registry
 * - GUI for plugin selection and discovery
 * - Real-time plugin switching
 * - WAM2 parameter automation via createGui
 * 
 * @example
 * const wam = new OutputWAM2(audioContext)
 * await wam.initialize()
 * await wam.createGui() // Shows plugin selector UI
 * wam.noteOn(note, 127)
 * wam.noteOff(note)
 */
export default class OutputWAM2 implements IAudioOutput {
	
	static ID :number= 0

	#uuid: string
	#name: string = "WAM2 Output"
	#audioContext: AudioContext
	#pluginUrl: string | null = null
	#pluginNode: any = null
	#isConnected: boolean = false
	#activeNotes: Map<number, number> = new Map()
	#pluginInfo: any = null
	#guiContainer: HTMLElement | null = null
	#pluginDescriptor: WAM2PluginDescriptor | null = null
	#registryInitialized: boolean = false

	get uuid():string{
		return this.#uuid
	}

	get name(): string {
		return this.#name
	}

	get description(): string {
		return "Manages the WAM2 Audio Engine"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	get pluginNode(): any {
		return this.#pluginNode
	}

	get output(): AudioNode {
		return this.#pluginNode || this.#audioContext.createGain()
	}

	/**
	 * Create a new WAM2 output
	 * @param audioContext - The Web Audio API context
	 * @param pluginUrl - Optional URL to a specific WAM2 plugin (can be set later)
	 * @param name - Optional display name for this output
	 */
	constructor(audioContext: AudioContext, pluginUrl?: string, name?: string) {
		this.#audioContext = audioContext
		this.#pluginUrl = pluginUrl || null
		this.#uuid = "Output-WAM2-"+(OutputWAM2.ID++)

		if (name) {
			this.#name = name
		}
	}

	hasMidiOutput(): boolean {
		return false
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasAutomationOutput(): boolean {
		return false
	}
	hasMpeOutput(): boolean {
		return false
	}
	hasOscOutput(): boolean {
		return false
	}
	hasSysexOutput(): boolean {
		return false
	}

	/**
	 * Initialize the WAM2 plugin
	 * Must be called before using noteOn/noteOff
	 */
	async connect(): Promise<void> {
		try {
			// Load WAM2 plugin using the standardized API
			if (!(globalThis as any).WAM) {
				throw new Error("WAM2 host not available. Ensure WAM2 polyfill is loaded.")
			}

			const { default: plugin } = await import(this.#pluginUrl)
			
			if (!plugin || typeof plugin.createInstance !== "function") {
				throw new Error("Invalid WAM2 plugin: missing createInstance method")
			}

			// Create plugin instance
			this.#pluginNode = await plugin.createInstance(this.#audioContext, {
				moduleId: this.#pluginUrl,
			})

			// Store plugin metadata
			this.#pluginInfo = {
				name: plugin.name || "Unknown WAM2 Plugin",
				version: plugin.version || "1.0.0",
				vendor: plugin.vendor || "Unknown Vendor",
			}

			// Update display name with plugin info
			this.#name = `${this.#pluginInfo.name} (WAM2)`

			this.#isConnected = true
			console.info(`WAM2 plugin initialized: ${this.#name}`)
		} catch (error) {
			console.error("Failed to initialize WAM2 plugin:", error)
			throw new Error(
				`WAM2 initialization failed for ${this.#pluginUrl}: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Play a note on the WAM2 instrument
	 * @param noteNumber - The note to play
	 * @param velocity - MIDI velocity (0-127)
	 */
	noteOn(noteNumber: number, velocity: number = 127): void {
		if (!this.#isConnected || !this.#pluginNode) {
			console.warn("WAM2 output not initialized")
			return
		}

		// Clamp velocity to 0-127 range
		const midiVelocity = Math.max(0, Math.min(127, Math.round(velocity * 127)))
		const midiNote = Math.round(noteNumber)

		try {
			// Send MIDI note on message to the WAM2 plugin
			// Standard WAM2 API uses processMidi or midiBuffer interface
			if (typeof this.#pluginNode.processMidi === "function") {
				// Message format: [status, data1, data2]
				// 0x90 = Note On, data1 = note number, data2 = velocity
				this.#pluginNode.processMidi([NOTE_ON, midiNote, midiVelocity])
			} else if (this.#pluginNode.midiBuffer) {
				// Alternative: use midiBuffer (for some WAM2 implementations)
				this.#pluginNode.midiBuffer.push([NOTE_ON, midiNote, midiVelocity])
			} else {
				console.warn("WAM2 plugin does not support MIDI input")
			}

			// Track active note
			this.#activeNotes.set(midiNote, noteNumber)
		} catch (error) {
			console.error("WAM2 noteOn failed:", error)
		}
	}

	/**
	 * Stop playing a note on the WAM2 instrument
	 * @param note - The note to stop
	 */
	noteOff(noteNumber:number): void {
		if (!this.#isConnected || !this.#pluginNode) {
			console.warn("WAM2 output not initialized")
			return
		}

		const midiNote = Math.round(noteNumber)

		try {
			// Send MIDI note off message
			// 0x80 = Note Off, data1 = note number, data2 = velocity (usually 0)
			if (typeof this.#pluginNode.processMidi === "function") {
				this.#pluginNode.processMidi([0x80, midiNote, 0])
			} else if (this.#pluginNode.midiBuffer) {
				this.#pluginNode.midiBuffer.push([0x80, midiNote, 0])
			}

			// Untrack note
			this.#activeNotes.delete(midiNote)
		} catch (error) {
			console.error("WAM2 noteOff failed:", error)
		}
	}

	/**
	 * Stop all notes currently playing on the WAM2 instrument
	 */
	allNotesOff(): void {
		if (!this.#isConnected || !this.#pluginNode) {
			return
		}

		try {
			// Send all notes off control change message
			// CC 123 = All Notes Off
			if (typeof this.#pluginNode.processMidi === "function") {
				this.#pluginNode.processMidi([0xb0, 123, 0])
			} else if (this.#pluginNode.midiBuffer) {
				this.#pluginNode.midiBuffer.push([0xb0, 123, 0])
			}

			this.#activeNotes.clear()
		} catch (error) {
			console.error("WAM2 allNotesOff failed:", error)
		}
	}

	/**
	 * Send a generic MIDI message to the WAM2 plugin
	 * @param midiMessage - Array of [status, data1, data2] bytes
	 */
	processMidi(midiMessage: [number, number, number]): void {
		if (!this.#isConnected || !this.#pluginNode) {
			console.warn("WAM2 output not initialized")
			return
		}

		try {
			if (typeof this.#pluginNode.processMidi === "function") {
				this.#pluginNode.processMidi(midiMessage)
			} else if (this.#pluginNode.midiBuffer) {
				this.#pluginNode.midiBuffer.push(midiMessage)
			}
		} catch (error) {
			console.error("WAM2 processMidi failed:", error)
		}
	}

	/**
	 * Send a CC (Control Change) message to the plugin
	 * @param controller - CC number (0-127)
	 * @param value - CC value (0-127)
	 * @param channel - MIDI channel (0-15)
	 */
	sendControlChange(controller: number, value: number, channel: number = 0): void {
		const status = 0xb0 + channel // 0xBn = CC message
		const ccValue = Math.max(0, Math.min(127, Math.round(value)))
		this.processMidi([status, controller, ccValue])
	}

	/**
	 * Get the number of active notes
	 */
	getActiveNoteCount(): number {
		return this.#activeNotes.size
	}

	/**
	 * Get plugin information
	 */
	getPluginInfo(): any {
		return this.#pluginInfo
	}

	/**
	 * Cleanup and disconnect the WAM2 plugin
	 */
	async disconnect(): Promise<void> {
		try {
			this.allNotesOff()
			
			if (this.#pluginNode && typeof this.#pluginNode.disconnect === "function") {
				await this.#pluginNode.disconnect()
			}

			this.#pluginNode = null
			this.#isConnected = false
			console.info("WAM2 plugin disconnected")
		} catch (error) {
			console.error("Error disconnecting WAM2 plugin:", error)
		}
	}

	/**
	 * Load a plugin by its registry descriptor
	 */
	async loadPlugin(descriptor: WAM2PluginDescriptor): Promise<void> {
		this.#pluginDescriptor = descriptor
		this.#pluginUrl = wam2Registry.getPluginUrl(descriptor)
		
		// Disconnect existing plugin if any
		if (this.#isConnected) {
			await this.disconnect()
		}

		// Connect new plugin
		await this.connect()
	}

	/**
	 * Create GUI for plugin selection and display
	 */
	async createGui(): Promise<HTMLElement> {
		// Initialize registry if not done yet
		if (!this.#registryInitialized) {
			try {
				await wam2Registry.initialize()
				this.#registryInitialized = true
			} catch (error) {
				console.error("Failed to initialize WAM2 registry:", error)
			}
		}

		this.#guiContainer = document.createElement("div")
		this.#guiContainer.id = this.#uuid
		this.#guiContainer.style.padding = "12px"
		this.#guiContainer.style.borderRadius = "4px"
		this.#guiContainer.style.backgroundColor = "#1e1e1e"
		this.#guiContainer.style.color = "#e0e0e0"
		this.#guiContainer.style.fontFamily = "system-ui, -apple-system, sans-serif"
		this.#guiContainer.style.fontSize = "13px"
		this.#guiContainer.style.minWidth = "300px"
		this.#guiContainer.style.display = "flex"
		this.#guiContainer.style.flexDirection = "column"
		this.#guiContainer.style.gap = "12px"

		// Title
		const title = document.createElement("h3")
		title.textContent = "WAM2 Plugin Selector"
		title.style.margin = "0 0 8px 0"
		title.style.fontSize = "14px"
		title.style.fontWeight = "600"
		title.style.color = "#fff"
		this.#guiContainer.appendChild(title)

		// Current plugin display
		const currentDisplay = document.createElement("div")
		currentDisplay.style.padding = "8px"
		currentDisplay.style.backgroundColor = "rgba(255,255,255,0.05)"
		currentDisplay.style.borderRadius = "3px"
		currentDisplay.style.fontSize = "12px"
		currentDisplay.style.minHeight = "40px"
		
		if (this.#pluginDescriptor) {
			currentDisplay.innerHTML = `
				<div style="font-weight: 600; color: #4fc3f7;">${this.#pluginDescriptor.name}</div>
				<div style="color: #999; margin-top: 2px;">${this.#pluginDescriptor.vendor}</div>
				<div style="color: #666; margin-top: 4px; font-size: 11px; line-height: 1.4;">${this.#pluginDescriptor.description}</div>
			`
		} else {
			currentDisplay.textContent = "No plugin loaded. Browse and select one below."
			currentDisplay.style.color = "#999"
		}
		this.#guiContainer.appendChild(currentDisplay)

		// Search box
		const searchContainer = document.createElement("div")
		searchContainer.style.display = "flex"
		searchContainer.style.gap = "6px"
		searchContainer.style.alignItems = "stretch"

		const searchInput = document.createElement("input")
		searchInput.type = "search"
		searchInput.placeholder = "Search plugins..."
		searchInput.style.flex = "1"
		searchInput.style.padding = "6px 8px"
		searchInput.style.backgroundColor = "rgba(255,255,255,0.1)"
		searchInput.style.border = "1px solid rgba(255,255,255,0.2)"
		searchInput.style.borderRadius = "3px"
		searchInput.style.color = "#e0e0e0"
		searchInput.style.fontSize = "12px"

		const categorySelect = document.createElement("select")
		categorySelect.style.padding = "6px 8px"
		categorySelect.style.backgroundColor = "rgba(255,255,255,0.1)"
		categorySelect.style.border = "1px solid rgba(255,255,255,0.2)"
		categorySelect.style.borderRadius = "3px"
		categorySelect.style.color = "#e0e0e0"
		categorySelect.style.fontSize = "12px"
		categorySelect.style.minWidth = "150px"

		const allOption = document.createElement("option")
		allOption.value = ""
		allOption.textContent = "All Categories"
		categorySelect.appendChild(allOption)

		// Add category options
		const grouped = wam2Registry.getGroupedByCategory()
		const sortedCategories = Array.from(grouped.keys()).sort()
		sortedCategories.forEach(category => {
			const option = document.createElement("option")
			option.value = category
			option.textContent = category
			categorySelect.appendChild(option)
		})

		searchContainer.appendChild(searchInput)
		searchContainer.appendChild(categorySelect)
		this.#guiContainer.appendChild(searchContainer)

		// Plugin list
		const pluginListContainer = document.createElement("div")
		pluginListContainer.style.display = "flex"
		pluginListContainer.style.flexDirection = "column"
		pluginListContainer.style.gap = "6px"
		pluginListContainer.style.maxHeight = "400px"
		pluginListContainer.style.overflowY = "auto"
		pluginListContainer.style.paddingRight = "4px"

		const updatePluginList = () => {
			pluginListContainer.innerHTML = ""
			
			let plugins = wam2Registry.getAll()
			const searchTerm = searchInput.value
			const selectedCategory = categorySelect.value

			if (searchTerm) {
				plugins = plugins.filter(p =>
					p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					p.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
					p.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
				)
			}

			if (selectedCategory) {
				plugins = plugins.filter(p => p.category.includes(selectedCategory))
			}

			if (plugins.length === 0) {
				const empty = document.createElement("div")
				empty.textContent = "No plugins found"
				empty.style.color = "#666"
				empty.style.padding = "12px 8px"
				pluginListContainer.appendChild(empty)
				return
			}

			plugins.forEach(plugin => {
				const item = document.createElement("button")
				item.type = "button"
				item.style.padding = "8px"
				item.style.backgroundColor = this.#pluginDescriptor?.identifier === plugin.identifier 
					? "rgba(79, 195, 247, 0.2)"
					: "rgba(255,255,255,0.05)"
				item.style.border = this.#pluginDescriptor?.identifier === plugin.identifier
					? "1px solid #4fc3f7"
					: "1px solid rgba(255,255,255,0.1)"
				item.style.borderRadius = "3px"
				item.style.color = "#e0e0e0"
				item.style.cursor = "pointer"
				item.style.textAlign = "left"
				item.style.transition = "all 0.2s ease"
				item.style.fontSize = "12px"

				item.innerHTML = `
					<div style="font-weight: 600; color: #4fc3f7;">${plugin.name}</div>
					<div style="color: #999; font-size: 11px; margin-top: 2px;">${plugin.vendor} • ${plugin.category.join(", ")}</div>
				`

				item.addEventListener("mouseenter", () => {
					item.style.backgroundColor = "rgba(255,255,255,0.1)"
				})

				item.addEventListener("mouseleave", () => {
					item.style.backgroundColor = this.#pluginDescriptor?.identifier === plugin.identifier 
						? "rgba(79, 195, 247, 0.2)"
						: "rgba(255,255,255,0.05)"
				})

				item.addEventListener("click", async () => {
					try {
						await this.loadPlugin(plugin)
						currentDisplay.innerHTML = `
							<div style="font-weight: 600; color: #4fc3f7;">${plugin.name}</div>
							<div style="color: #999; margin-top: 2px;">${plugin.vendor}</div>
							<div style="color: #666; margin-top: 4px; font-size: 11px; line-height: 1.4;">${plugin.description}</div>
						`
						updatePluginList()
					} catch (error) {
						console.error("Failed to load plugin:", error)
						const errorMsg = document.createElement("div")
						errorMsg.textContent = `Failed to load: ${error instanceof Error ? error.message : String(error)}`
						errorMsg.style.color = "#ff6b6b"
						errorMsg.style.padding = "8px"
						errorMsg.style.backgroundColor = "rgba(255, 107, 107, 0.1)"
						errorMsg.style.borderRadius = "3px"
						currentDisplay.appendChild(errorMsg)
					}
				})

				pluginListContainer.appendChild(item)
			})
		}

		searchInput.addEventListener("input", updatePluginList)
		categorySelect.addEventListener("change", updatePluginList)

		this.#guiContainer.appendChild(pluginListContainer)

		// Initial list population
		updatePluginList()

		return this.#guiContainer
	}

	/**
	 * Destroy GUI
	 */
	async destroyGui(): Promise<void> {
		if (this.#guiContainer && this.#guiContainer.parentElement) {
			this.#guiContainer.parentElement.removeChild(this.#guiContainer)
		}
		this.#guiContainer = null
	}
}




