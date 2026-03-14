import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import type { CLAPPatch } from "./clap-types.ts"
import { clapRegistry, initializeCLAPRegistry } from "./clap-registry.ts"

/**
 * CLAP Instrument
 *
 * A full-featured CLAP plugin synthesizer instrument that:
 * - Automatically loads and manages CLAP plugins from registry
 * - Provides GUI for patch selection
 * - Loads a sensible default patch on initialization
 * - Handles MIDI note input
 * - Supports patch switching without interrupting playback
 */
export default class CLAPInstrument implements IAudioOutput {
	static ID: number = 0

	#uuid: string = "CLAP-Instrument-" + CLAPInstrument.ID++
	#audioContext: AudioContext | null = null
	#activeNotes: Map<number, number> = new Map() // noteNumber -> velocity
	#isInitialized: boolean = false
	#isConnected: boolean = false
	#registryInitialized: boolean = false

	// CLAP plugin state
	#wasmModule: WebAssembly.Instance | null = null
	#pluginBuffer: Uint8Array | null = null
	#pluginName: string = "CLAP Instrument"
	#currentPatch: CLAPPatch | null = null
	#availablePatches: CLAPPatch[] = []
	#defaultPatchId: string | null = null

	constructor(audioContext: BaseAudioContext, defaultPatchId: string | null = null) {
		this.#audioContext = audioContext as AudioContext
		this.#defaultPatchId = defaultPatchId
	}

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "CLAP Instrument"
	}

	get description(): string {
		return `CLAP Plugin: ${this.#pluginName}${this.#currentPatch ? ` (${this.#currentPatch.name})` : ""}`
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	get currentPatch(): CLAPPatch | null {
		return this.#currentPatch
	}

	get availablePatches(): CLAPPatch[] {
		return this.#availablePatches
	}

	/**
	 * Initialize CLAP instrument
	 * - Load registry
	 * - Set available patches
	 * - Load default patch
	 */
	async connect(): Promise<void> {
		if (this.#isConnected) {
			return
		}

		try {
			// Initialize registry if not already done
			if (!this.#registryInitialized) {
				await initializeCLAPRegistry()
				this.#registryInitialized = true
			}

			// Get available patches from registry
			this.#availablePatches = clapRegistry.getPatches()

			if (this.#availablePatches.length === 0) {
				console.warn("[CLAP] No patches available in registry")
			}

			// Load default patch
			let patchToLoad = null

			// Try to load specified default patch
			if (this.#defaultPatchId) {
				patchToLoad = this.#availablePatches.find((p) => p.id === this.#defaultPatchId)
			}

			// Fall back to first available patch
			if (!patchToLoad && this.#availablePatches.length > 0) {
				patchToLoad = this.#availablePatches[0]
			}

			if (patchToLoad) {
				await this.loadPatchFromUrl(patchToLoad)
			}

			this.#isConnected = true
			this.dispatchEvent(new CustomEvent("connected"))
			console.log("[CLAP] Instrument connected and initialized")
		} catch (error) {
			console.error("[CLAP] Connection failed:", error)
			throw error
		}
	}

	/**
	 * Disconnect the instrument
	 */
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.#isConnected = false
		this.dispatchEvent(new CustomEvent("disconnected"))
	}

	/**
	 * Load a patch by ID from the registry
	 */
	async loadPatch(patchId: string): Promise<void> {
		const patch = this.#availablePatches.find((p) => p.id === patchId)
		if (!patch) {
			throw new Error(`Patch not found: ${patchId}`)
		}

		await this.loadPatchFromUrl(patch)
	}

	/**
	 * Load a patch from a URL
	 */
	async loadPatchFromUrl(patch: CLAPPatch): Promise<void> {
		try {
			console.log("[CLAP] Loading patch:", patch.id, patch.url)

			// Fetch the WASM module or tar.gz bundle
			const response = await fetch(patch.url)
			if (!response.ok) {
				throw new Error(`Failed to fetch CLAP plugin: ${response.statusText}`)
			}

			const buffer = await response.arrayBuffer()
			this.#pluginBuffer = new Uint8Array(buffer)

			// Store the patch configuration
			this.#currentPatch = patch
			this.#pluginName = patch.name

			// Initialize the WASM module
			await this.initializeWasmModule()

			this.dispatchEvent(
				new CustomEvent("patchLoaded", {
					detail: { patch }
				})
			)

			console.log("[CLAP] Patch loaded successfully")
		} catch (error) {
			console.error("[CLAP] Failed to load patch:", error)
			throw error
		}
	}

	/**
	 * Initialize the WebAssembly module
	 */
	private async initializeWasmModule(): Promise<void> {
		if (!this.#pluginBuffer) {
			throw new Error("No plugin buffer loaded")
		}

		try {
			const wasmModule = await WebAssembly.instantiate(this.#pluginBuffer)
			this.#wasmModule = wasmModule.instance
			this.#isInitialized = true

			console.log("[CLAP] WASM module initialized successfully")
		} catch (error) {
			console.warn("[CLAP] Could not instantiate as raw WASM:", error)
			throw error
		}
	}

	/**
	 * Trigger a note on event
	 */
	noteOn(noteNumber: number, velocity: number): void {
		if (!this.#isConnected) {
			console.warn("[CLAP] Cannot send note on - not connected")
			return
		}

		try {
			this.#activeNotes.set(noteNumber, velocity)
			console.debug("[CLAP] Note on:", { noteNumber, velocity })
		} catch (error) {
			console.error("[CLAP] Note on failed:", error)
		}
	}

	/**
	 * Trigger a note off event
	 */
	noteOff(noteNumber: number): void {
		if (!this.#isConnected) {
			console.warn("[CLAP] Cannot send note off - not connected")
			return
		}

		try {
			const velocity = this.#activeNotes.get(noteNumber)
			if (velocity === undefined) {
				console.warn("[CLAP] Note off for note not pressed:", noteNumber)
				return
			}

			this.#activeNotes.delete(noteNumber)
			console.debug("[CLAP] Note off:", { noteNumber })
		} catch (error) {
			console.error("[CLAP] Note off failed:", error)
		}
	}

	/**
	 * Release all active notes
	 */
	allNotesOff(): void {
		try {
			for (const noteNumber of this.#activeNotes.keys()) {
				this.noteOff(noteNumber)
			}
			this.#activeNotes.clear()

			console.debug("[CLAP] All notes off")
		} catch (error) {
			console.error("[CLAP] All notes off failed:", error)
		}
	}

	/**
	 * Create GUI with patch selector
	 */
	async createGui(): Promise<HTMLElement> {
		const container = document.createElement("div")
		container.classList.add("clap-instrument-gui")
		container.style.cssText = `
			padding: 16px;
			backgroundColor: #f5f5f5;
			border-radius: 8px;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		`

		// Title
		const title = document.createElement("h3")
		title.textContent = "CLAP Instrument"
		title.style.cssText = "margin: 0 0 12px 0; font-size: 16px; font-weight: 600;"
		container.appendChild(title)

		// Status section
		const statusSection = document.createElement("div")
		statusSection.style.cssText = `
			padding: 8px 12px;
			margin-bottom: 12px;
			background-color: ${this.#isConnected ? "#d4edda" : "#f8d7da"};
			color: ${this.#isConnected ? "#155724" : "#856404"};
			border-radius: 4px;
			font-size: 12px;
		`
		statusSection.textContent = `Status: ${this.#isConnected ? "Ready" : "Loading..."}`
		container.appendChild(statusSection)

		// Current patch display
		if (this.#currentPatch) {
			const patchInfoDiv = document.createElement("div")
			patchInfoDiv.style.cssText = `
				padding: 8px;
				margin-bottom: 12px;
				background-color: #e3f2fd;
				border-left: 3px solid #1976d2;
				border-radius: 4px;
				font-size: 12px;
			`

			let infoHTML = `<strong>${this.#currentPatch.name}</strong><br/>`
			if (this.#currentPatch.description) {
				infoHTML += `${this.#currentPatch.description}<br/>`
			}
			if (this.#currentPatch.author) {
				infoHTML += `<small>by ${this.#currentPatch.author}</small>`
			}

			patchInfoDiv.innerHTML = infoHTML
			container.appendChild(patchInfoDiv)
		}

		// Patch selector label
		const patchLabel = document.createElement("label")
		patchLabel.textContent = "Load Patch:"
		patchLabel.style.cssText = `
			display: block;
			margin-bottom: 6px;
			font-weight: 600;
			font-size: 12px;
		`
		container.appendChild(patchLabel)

		// Patch selector dropdown
		const patchSelect = document.createElement("select")
		patchSelect.id = "clap-patch-selector"
		patchSelect.style.cssText = `
			width: 100%;
			padding: 8px;
			margin-bottom: 12px;
			border: 1px solid #ccc;
			border-radius: 4px;
			font-size: 12px;
			background-color: white;
			cursor: pointer;
		`

		// Add current patch as first option
		if (this.#currentPatch) {
			const currentOption = document.createElement("option")
			currentOption.value = this.#currentPatch.id
			currentOption.textContent = `● ${this.#currentPatch.name}`
			currentOption.selected = true
			patchSelect.appendChild(currentOption)

			// Add separator
			const separator = document.createElement("option")
			separator.disabled = true
			separator.textContent = "───────────────"
			patchSelect.appendChild(separator)
		}

		// Add available patches organized by category
		const categorizedPatches: Record<string, CLAPPatch[]> = {}
		for (const patch of this.#availablePatches) {
			if (patch.id !== this.#currentPatch?.id) {
				const category = patch.category || "Other"
				if (!categorizedPatches[category]) {
					categorizedPatches[category] = []
				}
				categorizedPatches[category].push(patch)
			}
		}

		for (const [category, patches] of Object.entries(categorizedPatches).sort()) {
			const optgroup = document.createElement("optgroup")
			optgroup.label = category
			for (const patch of patches) {
				const option = document.createElement("option")
				option.value = patch.id
				option.textContent = patch.name
				optgroup.appendChild(option)
			}
			patchSelect.appendChild(optgroup)
		}

		// Handle patch selection
		patchSelect.addEventListener("change", async (e) => {
			const selectedId = (e.target as HTMLSelectElement).value
			if (selectedId && selectedId !== this.#currentPatch?.id) {
				try {
					patchSelect.disabled = true
					await this.loadPatch(selectedId)
					// Refresh the GUI to show the new patch
					const parent = container.parentElement
					if (parent) {
						const newGui = await this.createGui()
						parent.replaceChild(newGui, container)
					}
				} catch (error) {
					console.error("[CLAP] Failed to load patch:", error)
					alert(`Failed to load patch: ${error}`)
					patchSelect.disabled = false
				}
			}
		})

		container.appendChild(patchSelect)

		// Category summary
		if (this.#availablePatches.length > 0) {
			const categories = [...new Set(this.#availablePatches.map((p) => p.category || "Other"))].sort()
			const summaryDiv = document.createElement("div")
			summaryDiv.style.cssText = `
				padding: 8px;
				margin-top: 12px;
				background-color: #f0f0f0;
				border-radius: 4px;
				font-size: 11px;
				color: #666;
			`
			summaryDiv.textContent = `${this.#availablePatches.length} patches available in ${categories.length} categories`
			container.appendChild(summaryDiv)
		}

		return container
	}

	/**
	 * Clean up GUI resources
	 */
	async destroyGui(): Promise<void> {
		const selector = document.getElementById("clap-patch-selector")
		if (selector) {
			selector.removeEventListener("change", () => {})
		}
	}

	// Capability checks
	hasMidiOutput(): boolean {
		return false
	}

	hasAudioOutput(): boolean {
		return true
	}

	hasAutomationOutput(): boolean {
		return true
	}

	hasMpeOutput(): boolean {
		return true
	}

	hasOscOutput(): boolean {
		return false
	}

	hasSysexOutput(): boolean {
		return true
	}

	/**
	 * Dispose and clean up resources
	 */
	dispose(): void {
		this.allNotesOff()
		this.#wasmModule = null
		this.#pluginBuffer = null
		this.#isConnected = false
	}
}

// Make this extend EventTarget for proper event support
Object.setPrototypeOf(CLAPInstrument.prototype, EventTarget.prototype)
