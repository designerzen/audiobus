import type { IAudioOutput } from "./output-interface.ts"

export default class OutputMetronome extends EventTarget implements IAudioOutput {

	static ID: number = 0

	#uuid: string
	#audioContext: AudioContext | null = null
	#oscillator: OscillatorNode | null = null
	#gainNode: GainNode | null = null
	#isPlaying: boolean = false
	#container: HTMLElement | null = null
	#beatCounter: number = 0
	#beatDisplay: HTMLElement | null = null

	// Metronome settings
	#beatsPerMeasure: number = 4
	#accentColor: string = "#ff6b6b" // Red for downbeat
	#normalColor: string = "#4ecdc4" // Teal for other beats
	#frequency: number = 800 // Hz
	#accentFrequency: number = 1200 // Hz for downbeat
	#toneDuration: number = 50 // ms

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "Metronome"
	}

	get description(): string {
		return "Responds to MIDI clock signals with audible clicks and visual feedback"
	}

	get isConnected(): boolean {
		return true
	}

	get isHidden(): boolean {
		return false
	}

	constructor() {
		super()
		this.#uuid = "Output-Metronome-" + OutputMetronome.ID++
		this.#initAudioContext()
	}

	#initAudioContext(): void {
		try {
			const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext
			if (AudioContextClass) {
				this.#audioContext = new AudioContextClass()
				this.#gainNode = this.#audioContext.createGain()
				this.#gainNode.connect(this.#audioContext.destination)
				this.#gainNode.gain.value = 0.3
			}
		} catch (e) {
			console.warn("Could not initialize AudioContext for metronome", e)
		}
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
	 * Click sound - responds to MIDI clock signals
	 * Note: noteOn/noteOff are called for each MIDI clock
	 */
	noteOn(noteNumber: number, velocity: number): void {
		// Don't use noteNumber/velocity for metronome
		// Just produce a click sound
		this.#playClick()
	}

	noteOff(noteNumber: number): void {
		// Metronome doesn't need noteOff handling
	}

	allNotesOff(): void {
		this.#stopClick()
	}

	/**
	 * Play a click sound
	 */
	#playClick(): void {
		if (!this.#audioContext || !this.#gainNode) return

		try {
			// Determine if this is a downbeat (every 24 MIDI clocks = quarter note)
			const isDownbeat = this.#beatCounter % this.#beatsPerMeasure === 0
			const frequency = isDownbeat ? this.#accentFrequency : this.#frequency
			const displayColor = isDownbeat ? this.#accentColor : this.#normalColor

			// Create and play oscillator
			const now = this.#audioContext.currentTime
			const oscillator = this.#audioContext.createOscillator()
			const envelopeGain = this.#audioContext.createGain()

			oscillator.frequency.value = frequency
			oscillator.type = "sine"

			// Connect audio graph
			oscillator.connect(envelopeGain)
			envelopeGain.connect(this.#gainNode)

			// Quick envelope - attack and decay
			envelopeGain.gain.setValueAtTime(0.8, now)
			envelopeGain.gain.exponentialRampToValueAtTime(0.01, now + this.#toneDuration / 1000)

			// Play
			oscillator.start(now)
			oscillator.stop(now + this.#toneDuration / 1000)

			// Update display
			this.#updateBeatDisplay(this.#beatCounter, displayColor)

			this.#beatCounter++
		} catch (e) {
			console.warn("Error playing metronome click", e)
		}
	}

	#stopClick(): void {
		// Nothing to stop - clicks are self-contained
	}

	/**
	 * Create GUI showing beat counter and settings
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
		this.#container.style.minWidth = "180px"

		// Beat display
		this.#beatDisplay = document.createElement("div")
		this.#beatDisplay.style.fontSize = "24px"
		this.#beatDisplay.style.fontWeight = "bold"
		this.#beatDisplay.style.textAlign = "center"
		this.#beatDisplay.style.padding = "8px"
		this.#beatDisplay.style.borderRadius = "4px"
		this.#beatDisplay.style.backgroundColor = "#e0e0e0"
		this.#beatDisplay.style.color = "#333"
		this.#beatDisplay.textContent = "●"
		this.#container.appendChild(this.#beatDisplay)

		// Settings section
		const settingsDiv = document.createElement("div")
		settingsDiv.style.borderTop = "1px solid #ccc"
		settingsDiv.style.paddingTop = "8px"

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
		bpmInput.style.width = "40px"
		bpmInput.style.padding = "2px"
		bpmInput.addEventListener("change", (e) => {
			const value = parseInt((e.target as HTMLInputElement).value, 10)
			if (value >= 1 && value <= 16) {
				this.#beatsPerMeasure = value
				this.#beatCounter = 0 // Reset beat counter
			}
		})
		bpmLabel.appendChild(bpmInput)
		settingsDiv.appendChild(bpmLabel)

		// Volume control
		const volLabel = document.createElement("label")
		volLabel.style.display = "flex"
		volLabel.style.gap = "4px"
		volLabel.style.alignItems = "center"
		volLabel.style.marginTop = "4px"
		volLabel.textContent = "Volume:"
		const volInput = document.createElement("input")
		volInput.type = "range"
		volInput.min = "0"
		volInput.max = "1"
		volInput.step = "0.1"
		volInput.value = String(this.#gainNode?.gain.value ?? 0.3)
		volInput.style.flex = "1"
		volInput.addEventListener("input", (e) => {
			const value = parseFloat((e.target as HTMLInputElement).value)
			if (this.#gainNode) {
				this.#gainNode.gain.value = value
			}
		})
		volLabel.appendChild(volInput)
		settingsDiv.appendChild(volLabel)

		// Info text
		const infoText = document.createElement("div")
		infoText.style.fontSize = "10px"
		infoText.style.color = "#666"
		infoText.style.fontStyle = "italic"
		infoText.style.marginTop = "4px"
		infoText.textContent = "Listens to MIDI clock signals"
		settingsDiv.appendChild(infoText)

		this.#container.appendChild(settingsDiv)

		return this.#container
	}

	async destroyGui(): Promise<void> {
		if (this.#container && this.#container.parentElement) {
			this.#container.parentElement.removeChild(this.#container)
		}
		this.#container = null
		this.#beatDisplay = null
	}

	#updateBeatDisplay(beatNumber: number, color: string): void {
		if (!this.#beatDisplay) return

		const beatPosition = beatNumber % this.#beatsPerMeasure
		const isDownbeat = beatPosition === 0

		this.#beatDisplay.style.backgroundColor = color
		this.#beatDisplay.style.color = "#fff"

		// Animate the display
		this.#beatDisplay.style.transform = "scale(1.2)"
		this.#beatDisplay.style.transition = "transform 100ms ease-out"

		setTimeout(() => {
			if (this.#beatDisplay) {
				this.#beatDisplay.style.transform = "scale(1)"
				this.#beatDisplay.style.transition = "transform 200ms ease-in"
			}
		}, 50)

		// Show beat position
		this.#beatDisplay.textContent = isDownbeat ? "●" : "○"
	}
}
