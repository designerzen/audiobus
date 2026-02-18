import { midiNoteToFrequency } from "../../conversion/note-to-frequency.ts"
import type { IAudioOutput } from "./output-interface.ts"

// import the component if it doesn't already exist
import "../../../pink-trombone/pink-trombone.js"

interface Config {
	enabled: number // 1 for on, 0 for off
	frequency: number // Base frequency for the voice
	loudness: number // 0-1, volume of the synthesis
	tenseness: number // 0-1, controls voiced/voiceless balance
}

const DEFAULT_OPTIONS: Config = {
	enabled: 1,
	frequency: 100,
	loudness: 1,
	tenseness: 0.6
}

/**
 * OutputPinkTrombone
 *
 * Integrates Pink Trombone (vocal synthesis engine) for speech-like sound generation.
 * Maps MIDI notes to vocal tract frequencies and controls synthesis parameters.
 */
export default class OutputPinkTrombone extends EventTarget implements IAudioOutput {

	static ID: number = 0

	#uuid: string
	#config: Config
	#pinkTromboneElement: HTMLElement | null = null
	#audioContext: AudioContext | null = null
	#activeNotes: Map<number, number> = new Map() // noteNumber -> frequency mapping
	#isInitialized: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return 'Pink Trombone'
	}

	get description(): string {
		return 'Vocal synthesis using Pink Trombone'
	}

	get isConnected(): boolean {
		return this.#isInitialized
	}

	get isHidden(): boolean {
		return false
	}

	constructor(config: Partial<Config> = DEFAULT_OPTIONS) {
		super()
		this.#uuid = "Output-Pink-Trombone-" + (OutputPinkTrombone.ID++)
		this.#config = { ...DEFAULT_OPTIONS, ...config }
		this.initialise()
	}

	/**
	 * Initialize Pink Trombone element and Audio Context
	 */
	private initialise(): void {
		if (typeof window === 'undefined') {
			return
		}

		try {
			// Create or find Pink Trombone element
			let element = document.querySelector('pink-trombone')

			if (!element) {
				element = document.createElement('pink-trombone')
				document.body.appendChild(element)
			}

			this.#pinkTromboneElement = element as HTMLElement

			// Create AudioContext
			this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

			// Wait for Pink Trombone to load
			this.#pinkTromboneElement.addEventListener('load', () => {
				this.onPinkTromboneLoaded()
			})

			// If already loaded, trigger initialization
			if ((this.#pinkTromboneElement as any).audioContext) {
				this.onPinkTromboneLoaded()
			}
		} catch (error) {
			console.debug('[PINK-TROMBONE] Initialization failed:', error)
		}
	}

	/**
	 * Update synthesis parameters
	 */
	private updateSynthesisParameters(): void {
		if (!this.#pinkTromboneElement || !this.#isInitialized) {
			return
		}

		try {
			const element = this.#pinkTromboneElement as any

			if (element.loudness) {
				element.loudness.value = this.#config.loudness
			}

			if (element.tenseness) {
				element.tenseness.value = this.#config.tenseness
			}

			if (element.frequency) {
				element.frequency.value = this.#config.frequency
			}
		} catch (error) {
			console.debug('[PINK-TROMBONE] Failed to update parameters:', error)
		}
	}

	/**
	 * Start Pink Trombone voice synthesis
	 */
	private startSynthesis(): void {
		if (!this.#pinkTromboneElement || !this.#config.enabled || !this.#isInitialized) {
			return
		}

		try {
			const element = this.#pinkTromboneElement as any
			if (element.start && typeof element.start === 'function') {
				element.start()
			}
		} catch (error) {
			console.debug('[PINK-TROMBONE] Failed to start synthesis:', error)
		}
	}

	/**
	 * Stop Pink Trombone voice synthesis
	 */
	private stopSynthesis(): void {
		if (!this.#pinkTromboneElement || !this.#isInitialized) {
			return
		}

		try {
			const element = this.#pinkTromboneElement as any
			if (element.stop && typeof element.stop === 'function') {
				element.stop()
			}
		} catch (error) {
			console.debug('[PINK-TROMBONE] Failed to stop synthesis:', error)
		}
	}

	/**
	 * Set vocal tract constriction based on note
	 * Maps different notes to different vocal tract configurations for varied phonemes
	 */
	private setVocalConstriction(noteNumber: number): void {
		if (!this.#pinkTromboneElement || !this.#isInitialized) {
			return
		}

		try {
			const element = this.#pinkTromboneElement as any

			// Map notes to different constriction positions
			// Creates variation in the vocal tract shape
			const normalizedNote = noteNumber % 12 // Get pitch class (0-11)
			const index = 20 + (normalizedNote / 12) * 20 // Range: 20-40
			const diameter = 1 + Math.sin(normalizedNote / 12 * Math.PI) * 2 // Vary diameter 0.3-3

			// Use the tongue constriction API from Pink Trombone
			// Add a new constriction or set existing one
			if (element.addConstriction && typeof element.addConstriction === 'function') {
				const constriction = element.addConstriction(index, diameter)
				if (!this.#activeNotes.has(noteNumber)) {
					this.#activeNotes.set(noteNumber, constriction)
				}
			}
		} catch (error) {
			console.debug('[PINK-TROMBONE] Failed to set vocal constriction:', error)
		}
	}

	/**
	 * Activate synthesis for a note
	 * Sets frequency and vocal tract configuration
	 */
	noteOn(noteNumber: number, velocity: number): void {
		if (!this.#config.enabled || !this.#isInitialized) {
			return
		}

		try {
			const frequency = midiNoteToFrequency(noteNumber)

			// Track active notes
			this.#activeNotes.set(noteNumber, frequency)

			// Start synthesis on first note
			if (this.#activeNotes.size === 1) {
				this.startSynthesis()
			}

			// Set frequency
			const element = this.#pinkTromboneElement as any
			if (element.frequency) {
				element.frequency.value = frequency
			}

			// Adjust loudness based on velocity
			if (element.loudness) {
				element.loudness.value = (velocity / 127) * this.#config.loudness
			}

			// Update vocal tract for this note
			this.setVocalConstriction(noteNumber)

			console.debug('[PINK-TROMBONE] Note on:', { noteNumber, frequency, velocity })
		} catch (error) {
			console.debug('[PINK-TROMBONE] Note on failed:', error)
		}
	}

	/**
	 * Deactivate synthesis for a note
	 */
	noteOff(noteNumber: number): void {
		try {
			const constriction = this.#activeNotes.get(noteNumber)
			this.#activeNotes.delete(noteNumber)

			// Remove constriction if it exists
			if (constriction && this.#pinkTromboneElement) {
				const element = this.#pinkTromboneElement as any
				if (element.removeConstriction && typeof element.removeConstriction === 'function') {
					element.removeConstriction(constriction)
				}
			}

			// Stop synthesis when all notes are released
			if (this.#activeNotes.size === 0) {
				this.stopSynthesis()
			} else if (this.#activeNotes.size > 0) {
				// If there are still active notes, use the highest frequency
				let highestFrequency = 0
				for (const freq of this.#activeNotes.values()) {
					if (typeof freq === 'number' && freq > highestFrequency) {
						highestFrequency = freq
					}
				}

				const element = this.#pinkTromboneElement as any
				if (element.frequency && highestFrequency > 0) {
					element.frequency.value = highestFrequency
				}
			}

			console.debug('[PINK-TROMBONE] Note off:', { noteNumber })
		} catch (error) {
			console.debug('[PINK-TROMBONE] Note off failed:', error)
		}
	}

	/**
	 * Stop all active notes
	 */
	allNotesOff(): void {
		try {
			this.#activeNotes.clear()
			this.stopSynthesis()
		} catch (error) {
			console.debug('[PINK-TROMBONE] All notes off failed:', error)
		}
	}

	/**
	 * Connect to audio context (optional)
	 */
	async connect(): Promise<void> {
		return new Promise((resolve) => {
			if (this.#isInitialized) {
				resolve()
			} else {
				this.addEventListener('connected', () => resolve(), { once: true })
			}
		})
	}

	/**
	 * Disconnect from audio context (optional)
	 */
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.#activeNotes.clear()
	}

	/**
	 * Create GUI controls for Pink Trombone parameters
	 */
	async createGui(): Promise<HTMLElement> {
		const container = document.createElement('div')
		container.classList.add('pink-trombone-gui')

		// Title
		const title = document.createElement('h3')
		title.innerText = 'Pink Trombone'
		container.appendChild(title)

		// Loudness control
		const loudnessLabel = document.createElement('label')
		loudnessLabel.innerText = 'Loudness:'
		container.appendChild(loudnessLabel)

		const loudnessSlider = document.createElement('input')
		loudnessSlider.type = 'range'
		loudnessSlider.id = 'pink-trombone-loudness'
		loudnessSlider.min = '0'
		loudnessSlider.max = '1'
		loudnessSlider.step = '0.01'
		loudnessSlider.value = this.#config.loudness.toString()
		loudnessSlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement
			this.#config.loudness = parseFloat(target.value)
			this.updateSynthesisParameters()
		})
		container.appendChild(loudnessSlider)

		// Tenseness control
		const tensenessLabel = document.createElement('label')
		tensenessLabel.innerText = 'Tenseness:'
		container.appendChild(tensenessLabel)

		const tensenessSlider = document.createElement('input')
		tensenessSlider.type = 'range'
		tensenessSlider.id = 'pink-trombone-tenseness'
		tensenessSlider.min = '0'
		tensenessSlider.max = '1'
		tensenessSlider.step = '0.01'
		tensenessSlider.value = this.#config.tenseness.toString()
		tensenessSlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement
			this.#config.tenseness = parseFloat(target.value)
			this.updateSynthesisParameters()
		})
		container.appendChild(tensenessSlider)

		// Frequency control
		const frequencyLabel = document.createElement('label')
		frequencyLabel.innerText = 'Frequency:'
		container.appendChild(frequencyLabel)

		const frequencySlider = document.createElement('input')
		frequencySlider.type = 'range'
		frequencySlider.id = 'pink-trombone-frequency'
		frequencySlider.min = '50'
		frequencySlider.max = '400'
		frequencySlider.step = '1'
		frequencySlider.value = this.#config.frequency.toString()
		frequencySlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement
			this.#config.frequency = parseFloat(target.value)
			this.updateSynthesisParameters()
		})
		container.appendChild(frequencySlider)

		// Pink Trombone element visualization
		const pinkTromboneContainer = document.createElement('div')
		pinkTromboneContainer.id = 'pink-trombone-element-container'
		if (this.#pinkTromboneElement) {
			// Show UI if available
			const element = this.#pinkTromboneElement as any
			if (element.startUI && typeof element.startUI === 'function') {
				element.startUI()
			}
		}
		container.appendChild(pinkTromboneContainer)

		return container
	}

	/**
	 * Destroy GUI controls for Pink Trombone
	 */
	async destroyGui(): Promise<void> {
		// Store event handler references for removal
		const handlers = new Map<string, EventListener>()

		const loudnessSlider = document.getElementById('pink-trombone-loudness') as HTMLInputElement
		const tensenessSlider = document.getElementById('pink-trombone-tenseness') as HTMLInputElement
		const frequencySlider = document.getElementById('pink-trombone-frequency') as HTMLInputElement

		if (loudnessSlider) {
			loudnessSlider.removeEventListener('input', handlers.get('loudness') || (() => {}))
		}
		if (tensenessSlider) {
			tensenessSlider.removeEventListener('input', handlers.get('tenseness') || (() => {}))
		}
		if (frequencySlider) {
			frequencySlider.removeEventListener('input', handlers.get('frequency') || (() => {}))
		}

		// Stop UI visualization
		if (this.#pinkTromboneElement) {
			const element = this.#pinkTromboneElement as any
			if (element.stopUI && typeof element.stopUI === 'function') {
				element.stopUI()
			}
		}
	}
	
	/**
	 * Handle Pink Trombone loaded event
	 */
	private onPinkTromboneLoaded(): void {
		if (!this.#pinkTromboneElement || !this.#audioContext) {
			return
		}

		try {
			const element = this.#pinkTromboneElement as any

			// Set the audio context
			Promise.resolve(element.setAudioContext(this.#audioContext)).then(() => {
				// Connect to audio destination
				element.connect(this.#audioContext!.destination)

				// Set initial parameters
				this.updateSynthesisParameters()

				this.#isInitialized = true
				this.dispatchEvent(new CustomEvent('connected'))

				console.debug('[PINK-TROMBONE] Initialized successfully')
			}).catch((error: Error) => {
				console.debug('[PINK-TROMBONE] Failed to setup audio:', error)
			})
		} catch (error) {
			console.debug('[PINK-TROMBONE] Error in onPinkTromboneLoaded:', error)
		}
	}

}

// Add type declaration for pink-trombone element
declare global {
	namespace JSX {
		interface IntrinsicElements {
			'pink-trombone': any
		}
	}
}
