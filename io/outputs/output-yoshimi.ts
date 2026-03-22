import { NOTE_ON, NOTE_OFF } from '../../commands'
import type { IAudioOutput } from "./output-interface.ts"

export interface YoshimiBank {
	name: string
	instruments: string[]
}

export interface YoshimiPreset {
	bank: string
	instrument: string
	filename: string
}

/**
 * Yoshimi Web Audio Module (WAM) Output
 * 
 * Integrates Yoshimi - a free and open source high quality software synthesizer
 * into the Harmoneasy audio engine. Yoshimi features:
 * - Polyphonic synthesis with 16 parts
 * - Rich library of presets organized by banks
 * - Real-time synthesis engine
 * 
 * Features:
 * - Load and switch between 700+ presets
 * - Organize presets by instrument banks
 * - Real-time MIDI note control
 * - Audio output to Web Audio API
 * - GUI for preset selection and browsing
 * 
 * @example
 * const yoshimi = new OutputYoshimi(audioContext)
 * await yoshimi.connect()
 * await yoshimi.loadPreset("Will_Godfrey_Collection", "0040-Master Synth Low.xiz")
 * yoshimi.noteOn(60, 100)
 * yoshimi.noteOff(60)
 */
export default class OutputYoshimi extends EventTarget implements IAudioOutput {
	
	static ID: number = 0

	#uuid: string = "Output-Yoshimi-" + (OutputYoshimi.ID++)
	#name: string = "Yoshimi"
	#audioContext: AudioContext
	#isConnected: boolean = false
	#activeNotes: Map<number, number> = new Map()
	#yoshimiInstance: any = null
	#currentBank: string = "Will_Godfrey_Collection"
	#currentPreset: string = "0040-Master Synth Low.xiz"
	#banks: YoshimiBank[] = []
	#guiContainer: HTMLElement | null = null
	#presetsLoaded: boolean = false
	#yoshimiLoaded: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return this.#name
	}

	get description(): string {
		return "Yoshimi Synthesizer - Free open source software synthesis engine with 700+ presets"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	get output(): AudioNode {
		if (!this.#yoshimiInstance) {
			return this.#audioContext.createGain()
		}
		
		// Yoshimi WAM outputs to destination, return a dummy gain node
		// The actual output is connected in connect()
		return this.#audioContext.createGain()
	}

	get currentBank(): string {
		return this.#currentBank
	}

	get currentPreset(): string {
		return this.#currentPreset
	}

	get banks(): YoshimiBank[] {
		return this.#banks
	}

	constructor(audioContext: AudioContext, name?: string) {
		super()
		this.#audioContext = audioContext
		
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
	 * Initialize and connect the Yoshimi WAM
	 * Loads the WAM scripts and creates the synthesizer instance
	 */
	async connect(): Promise<void> {
		try {
			console.info("Initializing Yoshimi...")

			// Check if WAM is available
			if (!(globalThis as any).WAM || !(globalThis as any).WAM.YOSHIMI) {
				await this.loadYoshimiScripts()
			}

			// Import scripts in correct order
			if (!this.#yoshimiLoaded) {
				const AWPF = (globalThis as any).AWPF
				const actx = this.#audioContext

				// Polyfill for AudioWorklet support
				if (AWPF && typeof AWPF.polyfill === 'function') {
					await AWPF.polyfill(actx)
				}

				// Load WAM controller and yoshimi
				if (!(globalThis as any).WAMController) {
					await this.loadScript("libs/wam-controller.js")
				}

				// Import Yoshimi scripts
				const origin = this.getYoshimiOrigin()
				const WAM = (globalThis as any).WAM
				
				if (WAM.YOSHIMI && typeof WAM.YOSHIMI.importScripts === 'function') {
					await WAM.YOSHIMI.importScripts(actx, origin)
				}

				this.#yoshimiLoaded = true
			}

			// Create Yoshimi instance
			const WAM = (globalThis as any).WAM
			if (!WAM || !WAM.YOSHIMI) {
				throw new Error("Yoshimi WAM not available")
			}

			const defaultState = {}
			this.#yoshimiInstance = new WAM.YOSHIMI(this.#audioContext, defaultState)

			// Connect to audio context destination
			this.#yoshimiInstance.connect(this.#audioContext.destination)

			// Load presets
			if (!this.#presetsLoaded) {
				await this.loadBanksList()
				this.#presetsLoaded = true
			}

			// Load initial preset
			if (this.#banks.length > 0) {
				await this.loadPreset(this.#currentBank, this.#currentPreset)
			}

			this.#isConnected = true
			console.info("Yoshimi initialized successfully")

		} catch (error) {
			console.error("Failed to initialize Yoshimi:", error)
			throw new Error(
				`Yoshimi initialization failed: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Play a note on the Yoshimi synthesizer
	 * @param noteNumber - MIDI note number (0-127)
	 * @param velocity - MIDI velocity (0-127)
	 */
	noteOn(noteNumber: number, velocity: number = 100): void {
		if (!this.#isConnected || !this.#yoshimiInstance) {
			console.warn("Yoshimi output not initialized")
			return
		}

		const midiNote = Math.max(0, Math.min(127, Math.round(noteNumber)))
		const midiVelocity = Math.max(0, Math.min(127, Math.round(velocity)))

		try {
			// Send MIDI note on (0x90 = Note On)
			if (typeof this.#yoshimiInstance.onMidi === 'function') {
				this.#yoshimiInstance.onMidi([0x90, midiNote, midiVelocity])
			}

			this.#activeNotes.set(midiNote, noteNumber)
		} catch (error) {
			console.error("Yoshimi noteOn failed:", error)
		}
	}

	/**
	 * Stop playing a note on the Yoshimi synthesizer
	 * @param noteNumber - MIDI note number (0-127)
	 */
	noteOff(noteNumber: number): void {
		if (!this.#isConnected || !this.#yoshimiInstance) {
			console.warn("Yoshimi output not initialized")
			return
		}

		const midiNote = Math.max(0, Math.min(127, Math.round(noteNumber)))

		try {
			// Send MIDI note off (0x80 = Note Off)
			if (typeof this.#yoshimiInstance.onMidi === 'function') {
				this.#yoshimiInstance.onMidi([0x80, midiNote, 0])
			}

			this.#activeNotes.delete(midiNote)
		} catch (error) {
			console.error("Yoshimi noteOff failed:", error)
		}
	}

	/**
	 * Stop all notes currently playing on the Yoshimi synthesizer
	 */
	allNotesOff(): void {
		if (!this.#isConnected || !this.#yoshimiInstance) {
			return
		}

		try {
			// Send all notes off (CC 123)
			if (typeof this.#yoshimiInstance.onMidi === 'function') {
				this.#yoshimiInstance.onMidi([0xb0, 123, 0])
			}

			this.#activeNotes.clear()
		} catch (error) {
			console.error("Yoshimi allNotesOff failed:", error)
		}
	}

	/**
	 * Send a generic MIDI message to Yoshimi
	 * @param midiMessage - Array of [status, data1, data2] bytes
	 */
	processMidi(midiMessage: [number, number, number]): void {
		if (!this.#isConnected || !this.#yoshimiInstance) {
			console.warn("Yoshimi output not initialized")
			return
		}

		try {
			if (typeof this.#yoshimiInstance.onMidi === 'function') {
				this.#yoshimiInstance.onMidi(midiMessage)
			}
		} catch (error) {
			console.error("Yoshimi processMidi failed:", error)
		}
	}

	/**
	 * Load a preset (instrument) from a bank
	 * @param bankName - Name of the bank (e.g., "Will_Godfrey_Collection")
	 * @param instrumentFilename - Filename of the instrument (e.g., "0040-Master Synth Low.xiz")
	 */
	async loadPreset(bankName: string, instrumentFilename: string): Promise<void> {
		if (!this.#isConnected || !this.#yoshimiInstance) {
			console.warn("Yoshimi not connected")
			return
		}

		try {
			const filename = `banks/${bankName}/${instrumentFilename}`
			const origin = this.getYoshimiOrigin()
			const url = new URL(filename, origin).href

			let data: string

			try {
				// Try to fetch as binary (gzipped)
				const resp = await fetch(url)
				const arrayBuffer = await resp.arrayBuffer()
				const gzip = new (globalThis as any).Zlib.Gunzip(new Uint8Array(arrayBuffer))
				const utf8 = gzip.decompress()
				data = new TextDecoder("utf-8").decode(utf8)
			} catch {
				// Fallback to plain text
				const resp = await fetch(url)
				data = await resp.text()
			}

			// Send preset data to Yoshimi
			if (typeof this.#yoshimiInstance.sendMessage === 'function') {
				this.#yoshimiInstance.sendMessage("set", "patch", data)
			}

			this.#currentBank = bankName
			this.#currentPreset = instrumentFilename

			console.info(`Loaded Yoshimi preset: ${bankName} / ${instrumentFilename}`)

			// Dispatch event for UI updates
			this.dispatchEvent(new CustomEvent('preset-changed', {
				detail: { bank: bankName, preset: instrumentFilename }
			}))

		} catch (error) {
			console.error("Failed to load Yoshimi preset:", error)
		}
	}

	/**
	 * Load the list of available banks and presets
	 */
	private async loadBanksList(): Promise<void> {
		try {
			const origin = this.getYoshimiOrigin()
			const url = new URL("banks/root.json", origin).href
			const resp = await fetch(url)
			const json = await resp.text()
			this.#banks = JSON.parse(json)
		} catch (error) {
			console.error("Failed to load Yoshimi banks list:", error)
			this.#banks = []
		}
	}

	/**
	 * Get the Yoshimi origin URL
	 */
	private getYoshimiOrigin(): string {
		// First check if AWPF has a predefined origin
		const AWPF = (globalThis as any).AWPF
		if (AWPF && AWPF.origin) {
			return AWPF.origin
		}

		// Use local path for development
		return "/packages/audiobus/wam/yoshimi/"
	}

	/**
	 * Load a script dynamically
	 */
	private async loadScript(scriptPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script")
			script.src = scriptPath
			script.onload = () => resolve()
			script.onerror = () => reject(new Error(`Failed to load script: ${scriptPath}`))
			document.head.appendChild(script)
		})
	}

	/**
	 * Load required Yoshimi scripts
	 */
	private async loadYoshimiScripts(): Promise<void> {
		try {
			// Load Zlib for gzip decompression
			if (!(globalThis as any).Zlib) {
				await this.loadScript("/packages/audiobus/wam/yoshimi/libs/gunzip.js")
			}

			// Load AudioWorklet polyfill
			if (!(globalThis as any).AWPF) {
				await this.loadScript("/packages/audiobus/wam/yoshimi/libs/audioworklet.js")
			}

			// Load QWERTY keyboard library (optional)
			if (!(globalThis as any).QwertyHancock) {
				await this.loadScript("/packages/audiobus/wam/yoshimi/libs/keys.js")
			}
		} catch (error) {
			console.warn("Some optional Yoshimi libraries failed to load:", error)
		}
	}

	/**
	 * Disconnect and cleanup Yoshimi
	 */
	async disconnect(): Promise<void> {
		try {
			this.allNotesOff()

			if (this.#yoshimiInstance && typeof this.#yoshimiInstance.disconnect === 'function') {
				await this.#yoshimiInstance.disconnect()
			}

			this.#yoshimiInstance = null
			this.#isConnected = false
			console.info("Yoshimi disconnected")
		} catch (error) {
			console.error("Error disconnecting Yoshimi:", error)
		}
	}

	/**
	 * Create GUI for preset selection and browsing
	 */
	async createGui(): Promise<HTMLElement> {
		this.#guiContainer = document.createElement("div")
		this.#guiContainer.id = this.#uuid
		this.#guiContainer.style.padding = "12px"
		this.#guiContainer.style.borderRadius = "4px"
		this.#guiContainer.style.backgroundColor = "#1a1a1a"
		this.#guiContainer.style.color = "#e0e0e0"
		this.#guiContainer.style.fontFamily = "system-ui, -apple-system, sans-serif"
		this.#guiContainer.style.fontSize = "13px"
		this.#guiContainer.style.minWidth = "350px"
		this.#guiContainer.style.display = "flex"
		this.#guiContainer.style.flexDirection = "column"
		this.#guiContainer.style.gap = "12px"

		// Title
		const title = document.createElement("h3")
		title.textContent = "Yoshimi Synthesizer"
		title.style.margin = "0 0 8px 0"
		title.style.fontSize = "14px"
		title.style.fontWeight = "600"
		title.style.color = "#fff"
		this.#guiContainer.appendChild(title)

		// Current preset display
		const currentDisplay = document.createElement("div")
		currentDisplay.style.padding = "8px"
		currentDisplay.style.backgroundColor = "rgba(255,255,255,0.05)"
		currentDisplay.style.borderRadius = "3px"
		currentDisplay.style.fontSize = "12px"
		currentDisplay.style.minHeight = "40px"
		
		currentDisplay.innerHTML = `
			<div style="font-weight: 600; color: #4fc3f7;">${this.#currentBank}</div>
			<div style="color: #999; margin-top: 4px;">${this.#currentPreset}</div>
		`
		this.#guiContainer.appendChild(currentDisplay)

		// Bank selector
		const bankContainer = document.createElement("div")
		bankContainer.style.display = "flex"
		bankContainer.style.flexDirection = "column"
		bankContainer.style.gap = "4px"

		const bankLabel = document.createElement("label")
		bankLabel.textContent = "Bank:"
		bankLabel.style.fontSize = "12px"
		bankLabel.style.color = "#bbb"
		bankContainer.appendChild(bankLabel)

		const bankSelect = document.createElement("select")
		bankSelect.style.padding = "6px 8px"
		bankSelect.style.backgroundColor = "rgba(255,255,255,0.1)"
		bankSelect.style.border = "1px solid rgba(255,255,255,0.2)"
		bankSelect.style.borderRadius = "3px"
		bankSelect.style.color = "#e0e0e0"
		bankSelect.style.fontSize = "12px"
		bankSelect.style.cursor = "pointer"

		this.#banks.forEach(bank => {
			const option = document.createElement("option")
			option.value = bank.name
			option.textContent = bank.name
			if (bank.name === this.#currentBank) {
				option.selected = true
			}
			bankSelect.appendChild(option)
		})

		bankContainer.appendChild(bankSelect)
		this.#guiContainer.appendChild(bankContainer)

		// Preset selector
		const presetContainer = document.createElement("div")
		presetContainer.style.display = "flex"
		presetContainer.style.flexDirection = "column"
		presetContainer.style.gap = "4px"

		const presetLabel = document.createElement("label")
		presetLabel.textContent = "Preset:"
		presetLabel.style.fontSize = "12px"
		presetLabel.style.color = "#bbb"
		presetContainer.appendChild(presetLabel)

		const presetSelect = document.createElement("select")
		presetSelect.style.padding = "6px 8px"
		presetSelect.style.backgroundColor = "rgba(255,255,255,0.1)"
		presetSelect.style.border = "1px solid rgba(255,255,255,0.2)"
		presetSelect.style.borderRadius = "3px"
		presetSelect.style.color = "#e0e0e0"
		presetSelect.style.fontSize = "12px"
		presetSelect.style.cursor = "pointer"
		presetSelect.style.maxHeight = "200px"
		presetSelect.style.overflowY = "auto"

		// Populate presets for initial bank
		const currentBank = this.#banks.find(b => b.name === this.#currentBank)
		if (currentBank) {
			currentBank.instruments.forEach(instrument => {
				const option = document.createElement("option")
				option.value = instrument
				option.textContent = instrument
				if (instrument === this.#currentPreset) {
					option.selected = true
				}
				presetSelect.appendChild(option)
			})
		}

		presetContainer.appendChild(presetSelect)
		this.#guiContainer.appendChild(presetContainer)

		// Event listeners for bank/preset changes
		bankSelect.addEventListener("change", async () => {
			const newBank = bankSelect.value
			
			// Update preset options
			presetSelect.innerHTML = ""
			const bank = this.#banks.find(b => b.name === newBank)
			if (bank) {
				bank.instruments.forEach(instrument => {
					const option = document.createElement("option")
					option.value = instrument
					option.textContent = instrument
					presetSelect.appendChild(option)
				})
				presetSelect.value = bank.instruments[0]
			}

			// Load first preset of new bank
			if (bank && bank.instruments.length > 0) {
				await this.loadPreset(newBank, bank.instruments[0])
			}
		})

		presetSelect.addEventListener("change", async () => {
			const newPreset = presetSelect.value
			await this.loadPreset(bankSelect.value, newPreset)
			
			// Update current display
			currentDisplay.innerHTML = `
				<div style="font-weight: 600; color: #4fc3f7;">${bankSelect.value}</div>
				<div style="color: #999; margin-top: 4px;">${newPreset}</div>
			`
		})

		// Listen for preset changes from other sources
		this.addEventListener('preset-changed', (event: any) => {
			bankSelect.value = event.detail.bank
			presetSelect.innerHTML = ""
			const bank = this.#banks.find(b => b.name === event.detail.bank)
			if (bank) {
				bank.instruments.forEach((instrument: string) => {
					const option = document.createElement("option")
					option.value = instrument
					option.textContent = instrument
					if (instrument === event.detail.preset) {
						option.selected = true
					}
					presetSelect.appendChild(option)
				})
			}
			currentDisplay.innerHTML = `
				<div style="font-weight: 600; color: #4fc3f7;">${event.detail.bank}</div>
				<div style="color: #999; margin-top: 4px;">${event.detail.preset}</div>
			`
		})

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
