import {
	EVENT_RESIZE,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_LEAVE,
	EVENT_LOST_POINTER_CAPTURE
} from "../../events/event-constants.ts"
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
	#resizeObserver: ResizeObserver | null = null
	#presets: any = null
	#activeNotes: Set<number> = new Set()
	#presetChangeTimer: NodeJS.Timeout | null = null
	#interactionEvents: AbortController | null = null
	#pointer: { id: number; x: number; y: number; time: number; distance: number } | null = null
	#lastTap: { x: number; y: number; time: number } | null = null
	#position = { x: 0, y: 0 }
	#pulse = 0
	#swipe = { x: 0, y: 0 }
	#lastFrameTime = 0

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
			throw new Error(
				"OutputButterchurn requires AudioContext - pass it explicitly or ensure gainNode.context exists"
			)
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
		this.#canvas = document.createElement("canvas")
		this.#canvas.width = 404
		this.#canvas.height = 256
		this.#canvas.className = "audiobus-butterchurn"
		this.#canvas.title =
			"Move to steer · press to pulse · double tap/click for a new preset · swipe to push"
		this.#bindInteractions()

		// Lazy load butterchurn library
		await this.#loadButterchurn()

		// Start visualization
		this.#startVisualization()

		// Start preset change timer (every 30 seconds)
		this.#presetChangeTimer = setInterval(() => {
			this.#changePreset()
		}, 30000)

		// Handle window resize
		window.addEventListener(EVENT_RESIZE, this.#handleResize)
		this.#resizeObserver = new ResizeObserver(this.#handleResize)
		this.#resizeObserver.observe(this.#canvas)

		return this.#canvas
	}

	async destroyGui(): Promise<void> {
		this.#interactionEvents?.abort()
		this.#interactionEvents = null
		this.#pointer = null
		this.#lastTap = null
		this.#position = { x: 0, y: 0 }
		this.#swipe = { x: 0, y: 0 }
		this.#pulse = 0
		this.#lastFrameTime = 0
		this.#resizeObserver?.disconnect()
		this.#resizeObserver = null
		this.#stopVisualization()
		if (this.#canvas) {
			this.#canvas.remove()
			this.#canvas = null
		}
		this.#visualizer?.disconnectAudio(this.#analyser)
		this.#visualizer = null
		if (this.#presetChangeTimer) {
			clearInterval(this.#presetChangeTimer)
			this.#presetChangeTimer = null
		}
		window.removeEventListener(EVENT_RESIZE, this.#handleResize)
	}

	async #loadButterchurn(): Promise<void> {
		if (this.#visualizer) {
			return
		}

		try {
			// Dynamically import butterchurn library
			const butterchurnModule = await import("butterchurn")
			const presetsModule = await import("butterchurn-presets")

			// The CommonJS build can wrap Butterchurn's default export twice.
			const butterchurn =
				butterchurnModule.default?.default || butterchurnModule.default || butterchurnModule
			const butterchurnPresets = presetsModule.default || presetsModule

			if (!this.#canvas) {
				throw new Error("Canvas not initialized")
			}

			// Create visualizer using the factory function
			this.#visualizer = butterchurn.createVisualizer(this.#audioContext, this.#canvas, {
				width: this.#canvas.width,
				height: this.#canvas.height,
				pixelRatio: 1
			})

			// Connect the analyser node to visualizer
			this.#visualizer.connectAudio(this.#analyser)

			// Load presets
			const getPresets =
				butterchurnPresets.getPresets || butterchurnPresets.default?.getPresets
			if (getPresets && typeof getPresets === "function") {
				this.#presets = Object.values(getPresets())
				if (this.#presets && this.#presets.length > 0) {
					const randomIndex = Math.floor(Math.random() * this.#presets.length)
					this.#loadInteractivePreset(this.#presets[randomIndex], 0.5)
				}
			}
		} catch (error) {
			console.error("Failed to load Butterchurn library:", error)
			throw new Error(
				"Butterchurn library failed to load. Ensure butterchurn and butterchurn-presets are installed."
			)
		}
	}

	#handleResize = () => {
		if (!this.#canvas || !this.#visualizer) {
			return
		}
		const rect = this.#canvas.getBoundingClientRect()
		if (rect.width > 0 && rect.height > 0) {
			this.#canvas.width = Math.round(rect.width * window.devicePixelRatio)
			this.#canvas.height = Math.round(rect.height * window.devicePixelRatio)
			// Butterchurn uses these dimensions for the final WebGL viewport.
			// They must match the drawing buffer; density is already applied above.
			this.#visualizer.setRendererSize(this.#canvas.width, this.#canvas.height, {
				pixelRatio: 1
			})
		}
	}

	#changePreset(): void {
		if (!this.#presets || this.#presets.length === 0 || !this.#visualizer) {
			return
		}

		// Pick a random preset
		const randomIndex = Math.floor(Math.random() * this.#presets.length)

		// Load preset with smooth transition (2 second blend)
		this.#loadInteractivePreset(this.#presets[randomIndex], 2.0)
	}

	#loadInteractivePreset(preset: any, blendTime: number): void {
		// Match Butterchurn's string-equation compilation, keeping the shared presets untouched.
		const compile = (equations: any, key: string) =>
			equations[key] || new Function("a", `${equations[`${key}_str`] || ""}; return a;`)
		const frame = compile(preset, "frame_eqs")
		this.#visualizer.loadPreset(
			{
				...preset,
				init_eqs: compile(preset, "init_eqs"),
				pixel_eqs:
					preset.pixel_eqs || (preset.pixel_eqs_str ? compile(preset, "pixel_eqs") : ""),
				frame_eqs: (variables: Record<string, number>) => {
					const result = frame(variables)
					result.rot += this.#position.x * 0.025
					result.zoom *= 1 + this.#position.y * 0.025 + this.#pulse * 0.035
					result.warp += this.#pulse * 1.5
					result.dx += this.#swipe.x * 0.025
					result.dy += this.#swipe.y * 0.025
					return result
				},
				shapes: preset.shapes.map((shape: any) => ({
					...shape,
					init_eqs: compile(shape, "init_eqs"),
					frame_eqs: compile(shape, "frame_eqs")
				})),
				waves: preset.waves.map((wave: any) => ({
					...wave,
					init_eqs: compile(wave, "init_eqs"),
					frame_eqs: compile(wave, "frame_eqs"),
					point_eqs: compile(wave, "point_eqs")
				}))
			},
			blendTime
		)
	}

	#updatePosition(event: PointerEvent): void {
		const rect = this.#canvas!.getBoundingClientRect()
		if (rect.width <= 0 || rect.height <= 0) {
			return
		}
		this.#position.x = Math.max(
			-1,
			Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)
		)
		this.#position.y = Math.max(
			-1,
			Math.min(1, 1 - ((event.clientY - rect.top) / rect.height) * 2)
		)
	}

	#bindInteractions(): void {
		const canvas = this.#canvas!
		this.#interactionEvents = new AbortController()
		const options = { signal: this.#interactionEvents.signal }
		canvas.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => {
				if (this.#pointer || !event.isPrimary || event.button !== 0) {
					return
				}
				event.stopPropagation()
				this.#updatePosition(event)
				this.#pointer = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					time: performance.now(),
					distance: 0
				}
				this.#pulse = 1
				canvas.setPointerCapture(event.pointerId)
			},
			options
		)
		canvas.addEventListener(
			EVENT_POINTER_MOVE,
			(event) => {
				if (!event.isPrimary || (this.#pointer && this.#pointer.id !== event.pointerId)) {
					return
				}
				this.#updatePosition(event)
				if (this.#pointer) {
					this.#pointer.distance = Math.max(
						this.#pointer.distance,
						Math.hypot(event.clientX - this.#pointer.x, event.clientY - this.#pointer.y)
					)
				}
			},
			options
		)
		canvas.addEventListener(
			EVENT_POINTER_UP,
			(event) => {
				const pointer = this.#pointer
				if (!pointer || pointer.id !== event.pointerId) {
					return
				}
				const now = performance.now()
				const dx = event.clientX - pointer.x
				const dy = event.clientY - pointer.y
				const distance = Math.max(pointer.distance, Math.hypot(dx, dy))
				if (distance < 12 && now - pointer.time < 350) {
					if (
						this.#lastTap &&
						now - this.#lastTap.time < 350 &&
						Math.hypot(
							event.clientX - this.#lastTap.x,
							event.clientY - this.#lastTap.y
						) < 24
					) {
						this.#changePreset()
						this.#lastTap = null
					} else {
						this.#lastTap = { x: event.clientX, y: event.clientY, time: now }
					}
				} else {
					this.#lastTap = null
					if (distance >= 40 && now - pointer.time < 700) {
						const rect = canvas.getBoundingClientRect()
						this.#swipe = {
							x: Math.max(-1, Math.min(1, dx / Math.max(1, rect.width))),
							y: Math.max(-1, Math.min(1, -dy / Math.max(1, rect.height)))
						}
						this.#pulse = 1
					}
				}
				this.#pointer = null
				if (canvas.hasPointerCapture(event.pointerId)) {
					canvas.releasePointerCapture(event.pointerId)
				}
				if (event.pointerType !== "mouse") {
					this.#position = { x: 0, y: 0 }
				}
			},
			options
		)
		const cancel = (event: PointerEvent) => {
			if (this.#pointer?.id !== event.pointerId) {
				return
			}
			this.#pointer = null
			this.#lastTap = null
			this.#position = { x: 0, y: 0 }
		}
		canvas.addEventListener(EVENT_POINTER_CANCEL, cancel, options)
		canvas.addEventListener(EVENT_LOST_POINTER_CAPTURE, cancel, options)
		canvas.addEventListener(
			EVENT_POINTER_LEAVE,
			() => {
				if (!this.#pointer) {
					this.#position = { x: 0, y: 0 }
				}
			},
			options
		)
	}

	#startVisualization(): void {
		if (this.#isRunning || !this.#visualizer) {
			return
		}
		this.#isRunning = true
		this.#animate()
	}

	#animate = (): void => {
		this.#animationFrameId = requestAnimationFrame(this.#animate)

		if (!this.#visualizer) {
			return
		}

		try {
			const now = performance.now()
			const decay = Math.exp(-Math.max(0, now - (this.#lastFrameTime || now)) / 300)
			this.#lastFrameTime = now
			this.#pulse = this.#pointer ? 1 : this.#pulse * decay
			this.#swipe.x *= decay
			this.#swipe.y *= decay
			this.#visualizer.render()
		} catch (error) {
			console.error("Error rendering Butterchurn:", error)
		}
	}

	#stopVisualization(): void {
		if (!this.#isRunning) {
			return
		}
		this.#isRunning = false
		if (this.#animationFrameId !== null) {
			cancelAnimationFrame(this.#animationFrameId)
			this.#animationFrameId = null
		}
	}

	noteOn(note: number, _velocity: number): void {
		// Track active notes
		this.#activeNotes.add(note)

		// Influence visualization based on active note count and velocity
		if (this.#visualizer) {
			// Adjust rendering quality/speed based on polyphony
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