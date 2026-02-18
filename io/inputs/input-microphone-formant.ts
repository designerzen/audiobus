/**
 * Microphone Input with Formant-based Pitch Detection
 * 
 * Captures audio from the microphone and detects pitch using:
 * - Spectral analysis (FFT) for high-performance formant detection
 * - YIN algorithm fallback for reliable fundamental frequency extraction
 * - Real-time MIDI note mapping from detected pitch
 */
import AbstractInput from "./abstract-input.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"
import { NOTE_ON, NOTE_OFF } from '../../commands'
import { frequencyToNote, frequencyToNoteCents } from "../../conversion/frequency-to-note.ts"

import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

interface PitchResult {
	frequency: number
	confidence: number
	hasChanged: boolean
}

export const MICROPHONE_INPUT_ID = "Microphone"

const DEFAULT_OPTIONS = {
	smoothing: 0.8,
	threshold: 0.01,
	fftSize: 4096,
	minFrequency: 80,
	maxFrequency: 1000,
	confidenceThreshold: 0.9,
	analyzeInterval: 50 		// ms
}

export const VOCAL_OPTIONS = {
	smoothing: 0.85,
	minFrequency: 80,        	// Low soprano
	maxFrequency: 1000,      	// High soprano/tenor
	confidenceThreshold: 0.85,
	analyzeInterval: 40,     	// Slightly faster for vocal responsiveness
	fftSize: 4096            	// Better frequency resolution
}

export const INSTRUMENT_OPTIONS = {
	smoothing: 0.8,
	minFrequency: 60,        	// Low notes
	maxFrequency: 2000,      	// Extended range
	confidenceThreshold: 0.8,
	analyzeInterval: 50,     	// Standard interval
	fftSize: 4096
}

export const POWER_OPTIONS = {
	smoothing: 0.9,
	minFrequency: 50,
	maxFrequency: 3000,      	// Extended range
	confidenceThreshold: 0.92,
	analyzeInterval: 100,    	// Slower but more stable
	fftSize: 8192            	// Better frequency resolution
}

/**
 * Formant Detector using FFT-based spectral analysis
 * with YIN algorithm for fundamental frequency extraction
 */
class FormantDetector {
	#analyser: AnalyserNode
	#dataArray: Uint8Array
	#floatData: Float32Array
	#fftSize: number
	#sampleRate: number
	#minFrequency: number
	#maxFrequency: number
	#confidenceThreshold: number
	#lastFrequency: number = 0
	#frequencySmoothingFactor: number

	constructor(
		context: AudioContext,
		analyser: AnalyserNode,
		options: Record<string, any>
	) {
		this.#analyser = analyser
		this.#fftSize = options.fftSize || 4096
		this.#sampleRate = context.sampleRate
		this.#minFrequency = options.minFrequency || 80
		this.#maxFrequency = options.maxFrequency || 1000
		this.#confidenceThreshold = options.confidenceThreshold || 0.9
		this.#frequencySmoothingFactor = options.smoothing || 0.8

		this.#analyser.fftSize = this.#fftSize
		this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount)
		this.#floatData = new Float32Array(this.#fftSize)
	}

	/**
	 * Detect pitch using YIN algorithm on time-domain data
	 * Best for vocal/monophonic sources
	 */
	#yinPitchDetection(buffer: Float32Array, threshold: number = 0.1): { frequency: number; confidence: number } {
		const size = buffer.length
		const maxlag = Math.floor(size / 2)
		const d = new Float32Array(maxlag)

		// Calculate autocorrelation
		let sumOfSquares = 0
		for (let i = 0; i < size; i++) {
			sumOfSquares += buffer[i] * buffer[i]
		}

		for (let lag = 0; lag < maxlag; lag++) {
			let sum = 0
			let normalization = 0
			for (let i = 0; i < size - lag; i++) {
				const diff = buffer[i] - buffer[i + lag]
				sum += diff * diff
				normalization += buffer[i] * buffer[i] + buffer[i + lag] * buffer[i + lag]
			}
			d[lag] = 2 * sum / (normalization || 1)
		}

		// Find the lowest point in the function
		let minIdx = 0
		for (let i = 1; i < maxlag; i++) {
			if (d[i] < d[minIdx]) {
				minIdx = i
			}
		}

		const foundPeriod = minIdx > 0 ? minIdx : -1
		const confidence = foundPeriod > 0 ? Math.max(0, 1 - d[foundPeriod]) : 0
		const frequency = foundPeriod > 0 ? this.#sampleRate / foundPeriod : 0

		return {
			frequency: Math.max(this.#minFrequency, Math.min(this.#maxFrequency, frequency)),
			confidence: Math.min(1, confidence)
		}
	}

	/**
	 * Detect pitch using spectral analysis (FFT)
	 * Good for harmonic sources, computationally efficient
	 */
	#spectralPitchDetection(): { frequency: number; confidence: number } {
		this.#analyser.getByteFrequencyData(this.#dataArray)

		// Find the strongest frequency peak
		let maxValue = 0
		let maxBinIndex = 0

		const minBin = Math.ceil((this.#minFrequency * this.#fftSize) / this.#sampleRate)
		const maxBin = Math.floor((this.#maxFrequency * this.#fftSize) / this.#sampleRate)

		for (let i = minBin; i < Math.min(maxBin, this.#dataArray.length); i++) {
			if (this.#dataArray[i] > maxValue) {
				maxValue = this.#dataArray[i]
			}
		}

		// Find peak with better precision
		for (let i = minBin; i < Math.min(maxBin, this.#dataArray.length); i++) {
			if (this.#dataArray[i] > maxValue * 0.8) {
				maxBinIndex = i
				break
			}
		}

		const frequency = (maxBinIndex * this.#sampleRate) / this.#fftSize
		const normalizedPeak = maxValue / 255
		const confidence = normalizedPeak

		return {
			frequency: Math.max(this.#minFrequency, Math.min(this.#maxFrequency, frequency)),
			confidence: Math.min(1, confidence)
		}
	}

	/**
	 * Detect formant frequencies (spectral peaks)
	 * Returns the fundamental and formants
	 */
	detect(timeBuffer: Float32Array | null): PitchResult {
		let result = this.#spectralPitchDetection()

		// If spectral detection is weak, fall back to YIN
		if (result.confidence < 0.6 && timeBuffer) {
			const yinResult = this.#yinPitchDetection(timeBuffer, 0.1)
			if (yinResult.confidence > result.confidence) {
				result = yinResult
			}
		}

		// Apply frequency smoothing to reduce jitter
		if (this.#lastFrequency > 0 && Math.abs(result.frequency - this.#lastFrequency) > 20) {
			result.frequency = this.#frequencySmoothingFactor * result.frequency +
				(1 - this.#frequencySmoothingFactor) * this.#lastFrequency
		}

		const hasChanged = Math.abs(result.frequency - this.#lastFrequency) > 5 // 5 Hz threshold
		this.#lastFrequency = result.frequency

		return {
			frequency: result.frequency,
			confidence: Math.min(1, result.confidence),
			hasChanged
		}
	}
}

export default class InputMicrophoneFormant extends AbstractInput implements IAudioInput {

	#audioContext: AudioContext | null = null
	#mediaStream: MediaStream | null = null
	#sourceNode: MediaStreamAudioSourceNode | null = null
	#analyser: AnalyserNode | null = null
	#formantDetector: FormantDetector | null = null
	#analyzeInterval: number = 0
	#isListening: boolean = false

	#currentNote: number = -1
	#lastNoteTime: number = 0
	#noteOnThreshold: number = 0.01
	#noteOffThreshold: number = 0.005

	#timeBuffer: Float32Array | null = null

	get name(): string {
		return MICROPHONE_INPUT_ID
	}

	get description(): string {
		return "Microphone"
	}

	get isListening(): boolean {
		return this.#isListening
	}

	constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
		super(options)
	}

	hasAudioInput(): boolean {
		return true
	}

	/**
	 * Request microphone access and initialize audio processing
	 */
	async connect(): Promise<void> {
		try {
			// Get microphone access
			this.#mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
					sampleRate: 44100
				}
			})

			// Create audio context and nodes
			this.#audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

			this.#sourceNode = this.#audioContext.createMediaStreamSource(this.#mediaStream)
			this.#analyser = this.#audioContext.createAnalyser()
			this.#analyser.smoothingTimeConstant = this.options.smoothing || 0.8

			// Connect nodes
			this.#sourceNode.connect(this.#analyser)

			// Initialize formant detector
			this.#formantDetector = new FormantDetector(
				this.#audioContext,
				this.#analyser,
				this.options
			)

			// Prepare time-domain buffer for YIN
			this.#timeBuffer = new Float32Array(this.#analyser.fftSize)

			// Start analysis loop
			this.#startAnalysis()

			this.#isListening = true
			this.setAsConnected()

			console.info("[Microphone Input] Connected and listening", {
				sampleRate: this.#audioContext.sampleRate
			})

		} catch (error: any) {
			this.setAsDisconnected()
			console.error("[Microphone Input] Failed to connect", error)
			throw error
		}
	}

	/**
	 * Stop listening and clean up resources
	 */
	async disconnect(): Promise<void> {
		try {
			this.#stopAnalysis()

			if (this.#mediaStream) {
				this.#mediaStream.getTracks().forEach(track => track.stop())
				this.#mediaStream = null
			}

			if (this.#sourceNode) {
				this.#sourceNode.disconnect()
				this.#sourceNode = null
			}

			if (this.#analyser) {
				this.#analyser.disconnect()
				this.#analyser = null
			}

			if (this.#audioContext && this.#audioContext.state !== 'closed') {
				await this.#audioContext.close()
				this.#audioContext = null
			}

			this.#isListening = false
			this.#currentNote = -1

			this.setAsDisconnected()

			console.info("[Microphone Input] Disconnected")

		} catch (error: any) {
			console.error("[Microphone Input] Error during disconnect", error)
		}
	}

	/**
	 * Start the pitch detection analysis loop
	 */
	#startAnalysis(): void {
		if (!this.#formantDetector || !this.#analyser) return

		const analyzeInterval = this.options.analyzeInterval || 50

		const analyze = () => {
			if (!this.#isListening) return

			// Get time-domain data for YIN algorithm
			if (this.#timeBuffer) {
				this.#analyser!.getFloatTimeDomainData(this.#timeBuffer)
			}

			// Detect pitch
			const result = this.#formantDetector!.detect(this.#timeBuffer)

			// Only process if confidence is above threshold
			if (result.confidence >= (this.options.confidenceThreshold || 0.9)) {
				const midiNote = frequencyToNote(result.frequency)

				// Handle note changes
				if (midiNote !== this.#currentNote) {
					if (this.#currentNote >= 0) {
						// Send note off for previous note
						this.#dispatchNoteOff(this.#currentNote)
					}
					// Send note on for new note
					this.#dispatchNoteOn(midiNote, result.confidence)
					this.#currentNote = midiNote
				} else if (result.hasChanged) {
					// Frequency changed but note is same, could update velocity/pitch bend
					// For now, we'll use pitch bend for fine-tuning
					const { cents } = frequencyToNoteCents(result.frequency)
					this.#dispatchPitchBend(cents)
				}
			} else if (this.#currentNote >= 0 && result.confidence < (this.options.threshold || 0.01)) {
				// Send note off if confidence drops below threshold
				this.#dispatchNoteOff(this.#currentNote)
				this.#currentNote = -1
			}

			this.#analyzeInterval = setTimeout(analyze, analyzeInterval)
		}

		analyze()
	}

	/**
	 * Stop the analysis loop
	 */
	#stopAnalysis(): void {
		if (this.#analyzeInterval) {
			clearTimeout(this.#analyzeInterval)
			this.#analyzeInterval = 0
		}
	}

	/**
	 * Dispatch note on command
	 */
	#dispatchNoteOn(noteNumber: number, confidence: number): void {
		const command: IAudioCommand = createAudioCommand(
			NOTE_ON,
			noteNumber,
			this.now,
			this.name
		)
		command.velocity = Math.round(confidence * 127)

		this.dispatch(command)

		console.info("[Microphone Input] Note On", {
			note: noteNumber,
			velocity: command.velocity,
			confidence
		})

		this.#lastNoteTime = this.now
	}

	/**
	 * Dispatch note off command
	 */
	#dispatchNoteOff(noteNumber: number): void {
		const command: IAudioCommand = createAudioCommand(
			NOTE_OFF,
			noteNumber,
			this.now,
			this.name
		)

		this.dispatch(command)

		console.info("[Microphone Input] Note Off", {
			note: noteNumber
		})
	}

	/**
	 * Dispatch pitch bend for fine-tuning
	 */
	#dispatchPitchBend(cents: number): void {
		// Convert cents (-100 to +100) to MIDI pitch bend (0 to 16383, center 8192)
		const pitchBendValue = Math.round(8192 + (cents / 100) * 8192)

		const command: IAudioCommand = createAudioCommand(
			"pitchBend" as any,
			0,
			this.now,
			this.name
		)
		command.value = Math.max(0, Math.min(16383, pitchBendValue))

		this.dispatch(command)
	}

	/**
	 * Cleanup on destroy
	 */
	async destroy(): Promise<void> {
		if (this.#isListening) {
			await this.disconnect()
		}
	}
}




