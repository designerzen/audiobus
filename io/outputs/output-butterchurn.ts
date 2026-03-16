import type { IAudioOutput } from "./output-interface.ts"
import "./output-butterchurn.css"

export default class OutputButterchurn implements IAudioOutput {
	static ID: number = 0

	#uuid: string = "Output-Butterchurn-" + OutputButterchurn.ID++
	#canvas: HTMLCanvasElement | null = null
	#visualizer: any = null
	#isConnected: boolean = false
	#audioContext: AudioContext
	#analyser: AnalyserNode
	#gainNode: GainNode
	#animationFrameId: number | null = null
	#isRunning: boolean = false
	#presets: any = null
	#currentPresetIndex: number = 0
	#activeNotes: Set<number> = new Set()
	#presetChangeTimer: NodeJS.Timeout | null = null

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "Butterchurn"
	}

	get description(): string {
		return "WebGL music visualizer with animated psychedelic patterns synced to audio"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	constructor(gainNode: GainNode, audioContext?: AudioContext) {
		this.#gainNode = gainNode
		this.#audioContext = audioContext || (gainNode as any).context
		if (!this.#audioContext) {
			throw new Error('OutputButterchurn requires AudioContext - pass it explicitly or ensure gainNode.context exists')
		}

		// Create analyser for audio input
		this.#analyser = this.#audioContext.createAnalyser()
		this.#analyser.fftSize = 256

		// Connect gain node to analyser
		this.#gainNode.connect(this.#analyser)

		this.#isConnected = true
	}

	async createGui(): Promise<HTMLCanvasElement> {
		// Create canvas
		this.#canvas = document.createElement('canvas')
		this.#canvas.width = 404
		this.#canvas.height = 256
		this.#canvas.className = 'audiobus-butterchurn'

		// Lazy load butterchurn library
		await this.#loadButterchurn()

		// Start visualization
		this.#startVisualization()

		// Start preset change timer (every 30 seconds)
		this.#presetChangeTimer = setInterval(() => {
			this.#changePreset()
		}, 30000)

		// Handle window resize
		window.addEventListener('resize', this.#handleResize)

		return this.#canvas
	}

	async destroyGui(): Promise<void> {
		this.#stopVisualization()
		if (this.#canvas) {
			this.#canvas.remove()
			this.#canvas = null
		}
		if (this.#presetChangeTimer) {
			clearInterval(this.#presetChangeTimer)
			this.#presetChangeTimer = null
		}
		window.removeEventListener('resize', this.#handleResize)
	}

	async #loadButterchurn(): Promise<void> {
		if (this.#visualizer) return

		try {
			// Dynamically import butterchurn library
			const butterchurnModule = await import('butterchurn')
			const presetsModule = await import('butterchurn-presets')

			const butterchurn = butterchurnModule.default || butterchurnModule
			const butterchurnPresets = presetsModule.default || presetsModule

			if (!this.#canvas) {
				throw new Error('Canvas not initialized')
			}

			// Create visualizer using the factory function
			this.#visualizer = butterchurn.createVisualizer(this.#audioContext, this.#canvas, {
				width: this.#canvas.width,
				height: this.#canvas.height,
				pixelRatio: window.devicePixelRatio,
			})

			// Connect the analyser node to visualizer
			this.#visualizer.connectAudio(this.#analyser)

			// Load presets
			const getPresets = butterchurnPresets.getPresets || butterchurnPresets.default?.getPresets
			if (getPresets && typeof getPresets === 'function') {
				this.#presets = Object.values(getPresets())
				if (this.#presets && this.#presets.length > 0) {
					const randomIndex = Math.floor(Math.random() * this.#presets.length)
					this.#visualizer.loadPreset(this.#presets[randomIndex], 0.5)
					this.#currentPresetIndex = randomIndex
				}
			}
		} catch (error) {
			console.error('Failed to load Butterchurn library:', error)
			throw new Error('Butterchurn library failed to load. Ensure butterchurn and butterchurn-presets are installed.')
		}
	}

	#handleResize = () => {
		if (!this.#canvas || !this.#visualizer) return
		const rect = this.#canvas.getBoundingClientRect()
		if (rect.width > 0 && rect.height > 0) {
			this.#canvas.width = rect.width
			this.#canvas.height = rect.height
			this.#visualizer.setRendererSize(rect.width, rect.height, window.devicePixelRatio)
		}
	}

	#changePreset(): void {
		if (!this.#presets || this.#presets.length === 0 || !this.#visualizer) return
		
		// Pick a random preset
		const randomIndex = Math.floor(Math.random() * this.#presets.length)
		this.#currentPresetIndex = randomIndex
		
		// Load preset with smooth transition (2 second blend)
		this.#visualizer.loadPreset(this.#presets[randomIndex], 2.0)
	}

	#startVisualization(): void {
		if (this.#isRunning || !this.#visualizer) return
		this.#isRunning = true
		this.#animate()
	}

	#animate = (): void => {
		this.#animationFrameId = requestAnimationFrame(this.#animate)

		if (!this.#visualizer) return

		try {
			this.#visualizer.render()
		} catch (error) {
			console.error('Error rendering Butterchurn:', error)
		}
	}

	#stopVisualization(): void {
		if (!this.#isRunning) return
		this.#isRunning = false
		if (this.#animationFrameId !== null) {
			cancelAnimationFrame(this.#animationFrameId)
			this.#animationFrameId = null
		}
	}

	noteOn(note: number, velocity: number): void {
		// Track active notes
		this.#activeNotes.add(note)
		
		// Influence visualization based on active note count and velocity
		if (this.#visualizer) {
			// Adjust rendering quality/speed based on polyphony
			const intensity = Math.min(1.0, (this.#activeNotes.size / 8) + (velocity / 127))
			// Some butterchurn presets respond to audioLevel changes
			// This indirectly influences the visual intensity
		}
	}

	noteOff(note: number): void {
		// Untrack the note
		this.#activeNotes.delete(note)
		
		// When all notes end, could trigger visual changes
		if (this.#activeNotes.size === 0 && this.#presets && this.#presets.length > 1) {
			// Optional: slowly transition to a new preset when all notes are released
			// Uncomment to enable:
			// this.#changePreset()
		}
	}

	allNotesOff(): void {
		// Clear all active notes
		this.#activeNotes.clear()
	}
}
