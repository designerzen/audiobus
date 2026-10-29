import { noteNumberToName } from "../../conversion/note-to-name.ts"
import type { IAudioOutput } from "./output-interface.ts"
import { KokoroSpeech } from "./kokoro-speech.ts"
import { chordSpeechName } from "./speech-vocabulary.ts"
import { getAudioDestination } from "../../audio-destination"

interface Config {
	enabled: number // 1 for on, 0 for off
	pitch: number // 0-2, pitch of the voice
	volume: number // 0-1, volume of speech
	rateMultiplier: number // 0.5-2, multiplier for speech rate based on note
	interruption: boolean // cancel speech on noteOff
}

const DEFAULT_OPTIONS: Config = {
	enabled: 1,
	pitch: 1,
	volume: 1,
	rateMultiplier: 1,
	interruption: false
}

/**
 * OutputSpeechSynthesis
 *
 * Prefers Kokoro speech, with system voices as a fallback.
 * The note number affects the speech rate - higher notes are spoken faster.
 */
export default class OutputSpeechSynthesis extends EventTarget implements IAudioOutput {
	static ID: number = 0

	#uuid: string = "Output-Speech-Synthesis-" + OutputSpeechSynthesis.ID++
	config: Config
	synth: SpeechSynthesis | null = null
	currentUtterances: SpeechSynthesisUtterance[] = []
	private neural = new KokoroSpeech()
	private neuralFailed = false
	private generation = 0
	private context: AudioContext | null = null
	private source: AudioBufferSourceNode | null = null
	private gain: GainNode | null = null
	private disposed = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "Readout"
	}

	get description(): string {
		return "Speech Synthesis"
	}

	get isConnected(): boolean {
		return false
	}

	get isHidden(): boolean {
		return false
	}

	constructor(
		config: Partial<Config> = DEFAULT_OPTIONS,
		private sharedContext?: AudioContext,
		private destination?: AudioNode
	) {
		super()
		this.context = sharedContext ?? null
		this.config = { ...DEFAULT_OPTIONS, ...config }
		this.initialise()
		if (
			this.config.enabled &&
			typeof Worker !== "undefined" &&
			typeof AudioContext !== "undefined"
		) {
			try {
				this.neural.preload()
			} catch {
				/* Live speech can still use system voices. */
			}
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
	 * Initialize Web Speech Synthesis API
	 */
	private initialise(): void {
		if (typeof window === "undefined") {
			return
		}

		try {
			this.synth = window.speechSynthesis
		} catch (error) {
			console.debug("[SPEECH] Speech Synthesis API not available:", error)
		}
	}

	/**
	 * Calculate speech rate based on note number
	 * Lower notes = slower rate, higher notes = faster rate
	 * Maps MIDI note 0-127 to rate 0.5-2.0
	 */
	private calculateRate(noteNumber: number): number {
		const normalized = noteNumber / 127
		const baseRate = normalized * 1.5 + 0.5 // Range: 0.5 to 2.0
		return baseRate * this.config.rateMultiplier
	}

	/**
	 * Speak a note name
	 */
	private async speak(text: string, noteNumber: number): Promise<void> {
		if (!this.config.enabled || this.disposed) {
			return
		}
		this.cancelSpeech()
		const generation = this.generation
		if (
			!this.neuralFailed &&
			typeof Worker !== "undefined" &&
			typeof AudioContext !== "undefined"
		) {
			try {
				this.context ??= new AudioContext()
				// Resume during the initiating user gesture, before model loading.
				const [audio] = await Promise.all([
					this.neural.generate(text),
					this.context.resume()
				])
				if (generation !== this.generation || !this.config.enabled || this.disposed) {
					return
				}
				const buffer = this.context.createBuffer(1, audio.audio.length, audio.sampling_rate)
				buffer.copyToChannel(new Float32Array(audio.audio), 0)
				this.gain ??= this.context.createGain()
				this.gain.disconnect()
				this.gain.connect(this.destination ?? getAudioDestination(this.context))
				this.gain.gain.value = this.config.volume
				const source = this.context.createBufferSource()
				source.buffer = buffer
				source.playbackRate.value = this.calculateRate(noteNumber)
				source.detune.value = (this.config.pitch - 1) * 1200
				source.connect(this.gain)
				source.onended = () => {
					source.disconnect()
					if (this.source === source) {
						this.source = null
					}
				}
				this.source = source
				source.start()
				return
			} catch (error) {
				if (generation !== this.generation || !this.config.enabled || this.disposed) {
					return
				}
				this.neuralFailed = true
				this.neural.dispose()
				console.debug("[SPEECH] Kokoro unavailable, using system voice:", error)
			}
		}
		if (!this.synth) {
			return
		}

		try {
			const utterance = new SpeechSynthesisUtterance(text)
			utterance.rate = this.calculateRate(noteNumber)
			utterance.pitch = this.config.pitch
			utterance.volume = this.config.volume

			// Clean up utterance reference when done
			utterance.onend = utterance.onerror = () => {
				const index = this.currentUtterances.indexOf(utterance)
				if (index > -1) {
					this.currentUtterances.splice(index, 1)
				}
			}

			this.currentUtterances.push(utterance)
			this.synth.speak(utterance)
		} catch (error) {
			console.debug("[SPEECH] Speech synthesis failed:", error)
		}
	}

	/**
	 * Cancel all active speech
	 */
	private cancelSpeech(): void {
		this.generation++
		if (this.source) {
			this.source.stop()
			this.source.disconnect()
			this.source = null
		}
		if (!this.synth) {
			return
		}

		try {
			this.synth.cancel()
			this.currentUtterances = []
		} catch (error) {
			console.debug("[SPEECH] Failed to cancel speech:", error)
		}
	}

	/**
	 * Activate a voice that reads out the suplied
	 * note name and key
	 * @param noteNumber
	 * @param velocity
	 */
	noteOn(noteNumber: number, _velocity?: number): void {
		const noteName = noteNumberToName(noteNumber)
		void this.speak(noteName, noteNumber)
	}

	/**
	 * Deactivate the voice that reads out the suplied
	 * note name and key if interuption is specified
	 * @param noteNumber
	 */
	speakChord(root: string, quality: string): void {
		void this.speak(chordSpeechName(root, quality), 60)
	}

	noteOff(_noteNumber: number): void {
		// Cancel speech if interruption is enabled
		if (this.config.interruption) {
			this.cancelSpeech()
		}
	}

	/**
	 * Deactivate all voices
	 */
	allNotesOff(): void {
		this.cancelSpeech()
	}

	async disconnect(): Promise<void> {
		this.disposed = true
		this.cancelSpeech()
		this.neural.dispose()
		this.gain?.disconnect()
		if (!this.sharedContext) {
			await this.context?.close()
		}
	}
}