import { noteNumberToName } from "../../conversion/note-to-name.ts"
import type { IAudioOutput } from "./output-interface.ts"

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
 * Uses the Web Speech Synthesis API to "sing" note names.
 * The note number affects the speech rate - higher notes are spoken faster.
 */
export default class OutputSpeechSynthesis extends EventTarget implements IAudioOutput {

	static ID:number = 0

	#uuid:string
	config: Config
	synth: SpeechSynthesis | null = null
	currentUtterances: SpeechSynthesisUtterance[] = []

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return 'Readout'
	}

	get description():string{
		return 'Speech Synthesis'
	}

	get isConnected(): boolean {
		return false
	}

	get isHidden(): boolean {
		return false
	}

	constructor(config: Partial<Config> = DEFAULT_OPTIONS) {
		super()
		this.#uuid = "Output-Speech-Synthesis-"+(OutputSpeechSynthesis.ID++)
		this.config = { ...DEFAULT_OPTIONS, ...config }
		this.initialise()
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
		if (typeof window === 'undefined') {
			return
		}

		try {
			this.synth = window.speechSynthesis
		} catch (error) {
			console.debug('[SPEECH] Speech Synthesis API not available:', error)
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
	private speak(text: string, noteNumber: number): void {
		if (!this.synth || !this.config.enabled) {
			return
		}

		try {
			// Cancel any existing utterances for this note to avoid overlapping speech
			this.cancelSpeech()

			const utterance = new SpeechSynthesisUtterance(text)
			utterance.rate = this.calculateRate(noteNumber)
			utterance.pitch = this.config.pitch
			utterance.volume = this.config.volume

			// Clean up utterance reference when done
			utterance.onend = () => {
				const index = this.currentUtterances.indexOf(utterance)
				if (index > -1) {
					this.currentUtterances.splice(index, 1)
				}
			}

			this.currentUtterances.push(utterance)
			this.synth.speak(utterance)
		} catch (error) {
			console.debug('[SPEECH] Speech synthesis failed:', error)
		}
	}

	/**
	 * Cancel all active speech
	 */
	private cancelSpeech(): void {
		if (!this.synth) {
			return
		}

		try {
			this.synth.cancel()
			this.currentUtterances = []
		} catch (error) {
			console.debug('[SPEECH] Failed to cancel speech:', error)
		}
	}

	/**
	 * Activate a voice that reads out the suplied
	 * note name and key
	 * @param noteNumber 
	 * @param velocity 
	 */
	noteOn(noteNumber: number, velocity: number): void {
		const noteName = noteNumberToName(noteNumber)
		this.speak(noteName, noteNumber)
	}

	/**
	 * Deactivate the voice that reads out the suplied
	 * note name and key if interuption is specified
	 * @param noteNumber 
	 */
	noteOff(noteNumber:number): void {
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
}
