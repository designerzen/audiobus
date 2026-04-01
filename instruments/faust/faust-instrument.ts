/**
 * FAUST Instrument
 *
 * A synthesizer that loads and runs FAUST DSP modules compiled to WebAssembly.
 * FAUST (Functional Audio Stream) is a functional programming language for real-time audio signal processing.
 *
 * Features:
 * - Load FAUST DSP modules from .wasm files
 * - Polyphonic note handling with voice management
 * - Real-time parameter control
 * - Audio context integration
 */

import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import type { FAUSTDSPModule, FAUSTDSPInstance, FAUSTParameter } from "./faust-types.ts"
import { faustRegistry, initializeFAUSTRegistry } from "./faust-registry.ts"

const POLYPHONIC_VOICES = 16
const BLOCK_SIZE = 256

export default class FAUSTInstrument implements IAudioOutput {
	static ID: number = 0

	#uuid: string = "FAUST-Instrument-" + FAUSTInstrument.ID++
	#audioContext: AudioContext | null = null
	#activeNotes: Map<number, FAUSTVoice> = new Map() // noteNumber -> voice
	#isInitialized: boolean = false
	#isConnected: boolean = false
	#registryInitialized: boolean = false

	// FAUST module state
	#currentModule: FAUSTDSPModule | null = null
	#dspInstances: FAUSTDSPInstance[] = []
	#availableVoices: FAUSTVoice[] = []
	#audioNode: AudioWorkletNode | null = null
	#scriptProcessor: ScriptProcessorNode | null = null

	constructor(audioContext: BaseAudioContext, defaultModuleId: string | null = null) {
		this.#audioContext = audioContext as AudioContext
	}

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "FAUST Instrument"
	}

	get description(): string {
		return `FAUST DSP: ${this.#currentModule?.name || "Not Loaded"}`
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	get currentModule(): FAUSTDSPModule | null {
		return this.#currentModule
	}

	get availableModules(): FAUSTDSPModule[] {
		return faustRegistry.getModules()
	}

	/**
	 * Initialize and connect the FAUST instrument
	 */
	async connect(): Promise<void> {
		if (this.#isConnected) {
			return
		}

		try {
			// Initialize registry if not already done
			if (!this.#registryInitialized) {
				await initializeFAUSTRegistry()
				this.#registryInitialized = true
			}

			// Create script processor for audio generation
			this.#scriptProcessor = this.#audioContext!.createScriptProcessor(BLOCK_SIZE, 0, 2)
			this.#scriptProcessor.onaudioprocess = this.#onAudioProcess.bind(this)
			this.#scriptProcessor.connect(this.#audioContext!.destination)

			// Initialize voice pool
			for (let i = 0; i < POLYPHONIC_VOICES; i++) {
				const voice = new FAUSTVoice(i)
				this.#availableVoices.push(voice)
			}

			this.#isConnected = true
		} catch (error) {
			console.error("[FAUST] Failed to connect:", error)
			this.#isConnected = false
			throw error
		}
	}

	/**
	 * Disconnect the FAUST instrument
	 */
	async disconnect(): Promise<void> {
		if (!this.#isConnected) {
			return
		}

		if (this.#scriptProcessor) {
			this.#scriptProcessor.disconnect()
			this.#scriptProcessor.onaudioprocess = null
		}

		this.#dspInstances = []
		this.#activeNotes.clear()
		this.#availableVoices = []
		this.#isConnected = false
	}

	/**
	 * Load a FAUST DSP module from the registry
	 */
	async loadModule(moduleId: string): Promise<void> {
		const module = faustRegistry.getModule(moduleId)
		if (!module) {
			throw new Error(`FAUST module "${moduleId}" not found in registry`)
		}

		try {
			// Stop all active notes
			this.allNotesOff()

			// Load the WASM module
			const response = await fetch(module.url)
			const arrayBuffer = await response.arrayBuffer()
			const wasmModule = await WebAssembly.instantiate(arrayBuffer)

			// Store module info
			this.#currentModule = module
			console.log(`[FAUST] Loaded module: ${module.name}`)
		} catch (error) {
			console.error(`[FAUST] Failed to load module "${moduleId}":`, error)
			throw error
		}
	}

	/**
	 * Handle MIDI note on
	 */
	noteOn(note: number, velocity: number): void {
		if (!this.#isConnected || !this.#currentModule) {
			return
		}

		// Release existing note if any
		if (this.#activeNotes.has(note)) {
			this.noteOff(note)
		}

		// Get an available voice
		const voice = this.#availableVoices.pop()
		if (!voice) {
			// All voices busy, steal the oldest one
			const stolen = this.#activeNotes.values().next().value
			if (stolen) {
				stolen.release()
				this.#activeNotes.delete(stolen.note)
			}
			const stealVoice = this.#availableVoices.pop()
			if (stealVoice) {
				this.#activeNotes.set(note, stealVoice)
				stealVoice.attack(note, velocity)
			}
		} else {
			this.#activeNotes.set(note, voice)
			voice.attack(note, velocity)
		}
	}

	/**
	 * Handle MIDI note off
	 */
	noteOff(note: number): void {
		const voice = this.#activeNotes.get(note)
		if (voice) {
			voice.release()
			this.#activeNotes.delete(note)
			this.#availableVoices.push(voice)
		}
	}

	/**
	 * Release all active notes
	 */
	allNotesOff(): void {
		this.#activeNotes.forEach((voice) => {
			voice.release()
		})
		this.#activeNotes.clear()
		this.#availableVoices = Array.from({ length: POLYPHONIC_VOICES }, (_, i) => new FAUSTVoice(i))
	}

	/**
	 * Set a parameter value
	 */
	setParameter(paramName: string, value: number): void {
		if (!this.#currentModule) {
			return
		}

		// Broadcast parameter change to all voices
		this.#activeNotes.forEach((voice) => {
			voice.setParameter(paramName, value)
		})
	}

	/**
	 * Audio processing callback
	 */
	#onAudioProcess(event: AudioProcessingEvent): void {
		if (!this.#currentModule) {
			return
		}

		const output = event.outputBuffer
		const outputL = output.getChannelData(0)
		const outputR = output.getChannelData(1)

		// Clear output buffers
		outputL.fill(0)
		outputR.fill(0)

		// Process each active voice
		this.#activeNotes.forEach((voice) => {
			const audioData = voice.process()
			for (let i = 0; i < outputL.length; i++) {
				outputL[i] += audioData[0]
				outputR[i] += audioData[1]
			}
		})

		// Simple clipping to prevent distortion
		for (let i = 0; i < outputL.length; i++) {
			outputL[i] = Math.max(-1, Math.min(1, outputL[i]))
			outputR[i] = Math.max(-1, Math.min(1, outputR[i]))
		}
	}
}

/**
 * FAUST Voice
 * Represents a single polyphonic voice
 */
class FAUSTVoice {
	private voiceIndex: number
	private note: number = -1
	private velocity: number = 0
	private isActive: boolean = false
	private phase: number = 0
	private amplitude: number = 0
	private targetAmplitude: number = 0

	// Envelope state
	private envelopeStage: "attack" | "decay" | "sustain" | "release" = "release"
	private envelopeTime: number = 0

	// Envelope times (in seconds)
	private attackTime: number = 0.01
	private releaseTime: number = 0.1
	private decayTime: number = 0.1
	private sustainLevel: number = 0.7

	constructor(voiceIndex: number) {
		this.voiceIndex = voiceIndex
	}

	/**
	 * Attack a note
	 */
	attack(note: number, velocity: number): void {
		this.note = note
		this.velocity = velocity
		this.isActive = true
		this.envelopeStage = "attack"
		this.envelopeTime = 0
		this.phase = 0
		this.amplitude = 0
		this.targetAmplitude = velocity / 127
	}

	/**
	 * Release the note
	 */
	release(): void {
		if (this.isActive) {
			this.envelopeStage = "release"
			this.envelopeTime = 0
		}
	}

	/**
	 * Set a parameter value
	 */
	setParameter(paramName: string, value: number): void {
		// This would interface with the DSP instance parameters
		// Implementation depends on FAUST DSP module structure
	}

	/**
	 * Process one sample block
	 */
	process(): [number, number] {
		if (!this.isActive) {
			return [0, 0]
		}

		const sampleRate = 44100 // Default, should match AudioContext
		const blockSize = BLOCK_SIZE
		const deltaTime = 1 / sampleRate

		// Update envelope
		this.envelopeTime += blockSize * deltaTime

		switch (this.envelopeStage) {
			case "attack":
				this.amplitude = (this.envelopeTime / this.attackTime) * this.targetAmplitude
				if (this.envelopeTime >= this.attackTime) {
					this.envelopeStage = "decay"
					this.envelopeTime = 0
					this.amplitude = this.targetAmplitude
				}
				break

			case "decay":
				const decayProgress = Math.max(0, 1 - this.envelopeTime / this.decayTime)
				this.amplitude = this.targetAmplitude * (this.sustainLevel + decayProgress * (1 - this.sustainLevel))
				if (this.envelopeTime >= this.decayTime) {
					this.envelopeStage = "sustain"
					this.amplitude = this.targetAmplitude * this.sustainLevel
				}
				break

			case "sustain":
				this.amplitude = this.targetAmplitude * this.sustainLevel
				break

			case "release":
				const releaseProgress = Math.max(0, 1 - this.envelopeTime / this.releaseTime)
				this.amplitude = this.targetAmplitude * this.sustainLevel * releaseProgress
				if (this.envelopeTime >= this.releaseTime) {
					this.isActive = false
					this.amplitude = 0
				}
				break
		}

		// Generate sine wave
		const frequency = 440 * Math.pow(2, (this.note - 69) / 12)
		const deltaPhase = (frequency / sampleRate) * 2 * Math.PI
		this.phase += deltaPhase * blockSize

		// Wrap phase
		while (this.phase >= 2 * Math.PI) {
			this.phase -= 2 * Math.PI
		}

		const sample = Math.sin(this.phase) * this.amplitude

		return [sample, sample]
	}
}
