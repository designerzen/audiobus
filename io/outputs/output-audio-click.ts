import type { IAudioOutput } from "./output-interface.ts"

export interface AudioAsset {
	id: string
	name: string
	path: string
}

export default class OutputAudioClick extends EventTarget implements IAudioOutput {

	static ID: number = 0

	#uuid: string = "Output-AudioClick-" + OutputAudioClick.ID++
	#audioContext: AudioContext | null = null
	#audioAssets: AudioAsset[] = []
	#selectedAssetId: string = ""
	#audioBuffers: Map<string, AudioBuffer> = new Map()
	#container: HTMLElement | null = null
	#beatCounter: number = 0
	#beatsPerMeasure: number = 4
	#barCounter: number = 0
	#volume: number = 0.5

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "Audio Click"
	}

	get description(): string {
		return "Plays audio click sounds from selected asset library on every bar"
	}

	get isConnected(): boolean {
		return true
	}

	get isHidden(): boolean {
		return false
	}

	constructor(audioContext: AudioContext) {
		super()
		if (!audioContext) {
			throw new Error('OutputAudioClick requires audioContext to be passed in constructor')
		}
		this.#audioContext = audioContext
		this.#loadAudioManifest()
	}

	hasMidiOutput(): boolean {
		return false
	}

	hasAudioOutput(): boolean {
		return !!this.#audioContext
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
	 * Load audio manifest and initialize asset list
	 */
	async #loadAudioManifest(): Promise<void> {
		try {
			const response = await fetch('/audio/audio-manifest.json')
			const manifest = await response.json()
			this.#audioAssets = manifest.assets || []

			// Set default selected asset to first one
			if (this.#audioAssets.length > 0) {
				this.#selectedAssetId = this.#audioAssets[0].id
				// Pre-load the first audio asset
				await this.#loadAudioAsset(this.#audioAssets[0].id)
			}
		} catch (error) {
			console.warn("Failed to load audio manifest", error)
		}
	}

	/**
	 * Load and decode an audio asset
	 */
	async #loadAudioAsset(assetId: string): Promise<void> {
		if (!this.#audioContext) return

		// Already loaded
		if (this.#audioBuffers.has(assetId)) return

		const asset = this.#audioAssets.find(a => a.id === assetId)
		if (!asset) return

		try {
			const response = await fetch(`/audio/${asset.path}`)
			const arrayBuffer = await response.arrayBuffer()
			const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer)
			this.#audioBuffers.set(assetId, audioBuffer)
		} catch (error) {
			console.warn(`Failed to load audio asset ${assetId}`, error)
		}
	}

	/**
	 * Play a click sound on bar trigger
	 * Responds to MIDI clock signals
	 * Every 24 MIDI clocks = quarter note (assuming 24 PPQ)
	 * A bar typically has 4 quarter notes, so every 96 MIDI clocks
	 */
	noteOn(_noteNumber?: number, _velocity?: number): void {
		// Increment beat counter for every MIDI clock
		const isBarTrigger = (this.#beatCounter % (this.#beatsPerMeasure * 24)) === 0

		if (isBarTrigger) {
			this.#playClick()
			this.#barCounter++
		}

		this.#beatCounter++
	}

	noteOff(_noteNumber?: number): void {
		// Audio click doesn't need noteOff handling
	}

	allNotesOff(): void {
		// Nothing to stop - audio clicks are self-contained
	}

	/**
	 * Play the selected audio click
	 */
	#playClick(): void {
		if (!this.#audioContext || !this.#selectedAssetId) return

		const audioBuffer = this.#audioBuffers.get(this.#selectedAssetId)
		if (!audioBuffer) return

		try {
			const source = this.#audioContext.createBufferSource()
			const gainNode = this.#audioContext.createGain()

			source.buffer = audioBuffer
			gainNode.gain.value = this.#volume

			source.connect(gainNode)
			gainNode.connect(this.#audioContext.destination)

			source.start(this.#audioContext.currentTime)
		} catch (error) {
			console.warn("Error playing audio click", error)
		}
	}

	/**
	 * Change the selected audio asset
	 */
	async selectAsset(assetId: string): Promise<void> {
		const asset = this.#audioAssets.find(a => a.id === assetId)
		if (!asset) return

		this.#selectedAssetId = assetId
		await this.#loadAudioAsset(assetId)
	}

	/**
	 * Set volume (0 to 1)
	 */
	setVolume(volume: number): void {
		this.#volume = Math.max(0, Math.min(1, volume))
	}

	/**
	 * Create GUI for audio click settings
	 */
	async createGui(): Promise<HTMLElement> {
		this.#container = document.createElement("div")
		this.#container.id = this.#uuid
		this.#container.style.padding = "12px"
		this.#container.style.borderRadius = "4px"
		this.#container.style.backgroundColor = "#f5f5f5"
		this.#container.style.fontFamily = "monospace"
		this.#container.style.fontSize = "12px"
		this.#container.style.display = "flex"
		this.#container.style.flexDirection = "column"
		this.#container.style.gap = "8px"
		this.#container.style.minWidth = "220px"

		// Bar counter display
		const barDisplay = document.createElement("div")
		barDisplay.style.fontSize = "18px"
		barDisplay.style.fontWeight = "bold"
		barDisplay.style.textAlign = "center"
		barDisplay.style.padding = "8px"
		barDisplay.style.borderRadius = "4px"
		barDisplay.style.backgroundColor = "#e0e0e0"
		barDisplay.style.color = "#333"
		barDisplay.textContent = `Bar: ${this.#barCounter}`
		this.#container.appendChild(barDisplay)

		// Update bar counter periodically
		const updateBarDisplay = setInterval(() => {
			if (this.#container?.parentElement) {
				barDisplay.textContent = `Bar: ${this.#barCounter}`
			} else {
				clearInterval(updateBarDisplay)
			}
		}, 500)

		// Settings section
		const settingsDiv = document.createElement("div")
		settingsDiv.style.borderTop = "1px solid #ccc"
		settingsDiv.style.paddingTop = "8px"
		settingsDiv.style.display = "flex"
		settingsDiv.style.flexDirection = "column"
		settingsDiv.style.gap = "6px"

		// Audio asset selector
		const assetLabel = document.createElement("label")
		assetLabel.style.display = "flex"
		assetLabel.style.flexDirection = "column"
		assetLabel.style.gap = "4px"
		assetLabel.textContent = "Click Sound:"

		const assetSelect = document.createElement("select")
		assetSelect.style.padding = "4px"
		assetSelect.style.borderRadius = "3px"
		assetSelect.style.border = "1px solid #ccc"
		assetSelect.style.fontFamily = "monospace"
		assetSelect.style.fontSize = "11px"

		// Wait for assets to load
		if (this.#audioAssets.length === 0) {
			await new Promise(resolve => setTimeout(resolve, 100))
		}

		this.#audioAssets.forEach((asset) => {
			const option = document.createElement("option")
			option.value = asset.id
			option.textContent = asset.name
			option.selected = asset.id === this.#selectedAssetId
			assetSelect.appendChild(option)
		})

		assetSelect.addEventListener("change", async (e) => {
			const assetId = (e.target as HTMLSelectElement).value
			await this.selectAsset(assetId)
		})

		assetLabel.appendChild(assetSelect)
		settingsDiv.appendChild(assetLabel)

		// Volume control
		const volLabel = document.createElement("label")
		volLabel.style.display = "flex"
		volLabel.style.gap = "4px"
		volLabel.style.alignItems = "center"
		volLabel.textContent = "Volume:"

		const volInput = document.createElement("input")
		volInput.type = "range"
		volInput.min = "0"
		volInput.max = "1"
		volInput.step = "0.1"
		volInput.value = String(this.#volume)
		volInput.style.flex = "1"
		volInput.style.cursor = "pointer"

		const volValue = document.createElement("span")
		volValue.style.minWidth = "24px"
		volValue.textContent = Math.round(this.#volume * 100) + "%"

		volInput.addEventListener("input", (e) => {
			const value = parseFloat((e.target as HTMLInputElement).value)
			this.setVolume(value)
			volValue.textContent = Math.round(value * 100) + "%"
		})

		volLabel.appendChild(volInput)
		volLabel.appendChild(volValue)
		settingsDiv.appendChild(volLabel)

		// Beats per measure
		const bpmLabel = document.createElement("label")
		bpmLabel.style.display = "flex"
		bpmLabel.style.gap = "4px"
		bpmLabel.style.alignItems = "center"
		bpmLabel.textContent = "Beats/Measure:"

		const bpmInput = document.createElement("input")
		bpmInput.type = "number"
		bpmInput.min = "1"
		bpmInput.max = "16"
		bpmInput.value = String(this.#beatsPerMeasure)
		bpmInput.style.width = "50px"
		bpmInput.style.padding = "2px"
		bpmInput.addEventListener("change", (e) => {
			const value = parseInt((e.target as HTMLInputElement).value, 10)
			if (value >= 1 && value <= 16) {
				this.#beatsPerMeasure = value
				this.#beatCounter = 0
				this.#barCounter = 0
			}
		})

		bpmLabel.appendChild(bpmInput)
		settingsDiv.appendChild(bpmLabel)

		// Info text
		const infoText = document.createElement("div")
		infoText.style.fontSize = "10px"
		infoText.style.color = "#666"
		infoText.style.fontStyle = "italic"
		infoText.style.marginTop = "4px"
		infoText.textContent = "Triggers on every bar (synchronized to MIDI clock)"
		settingsDiv.appendChild(infoText)

		this.#container.appendChild(settingsDiv)

		return this.#container
	}

	async destroyGui(): Promise<void> {
		if (this.#container && this.#container.parentElement) {
			this.#container.parentElement.removeChild(this.#container)
		}
		this.#container = null
	}
}
