import { EVENT_ERROR, EVENT_CLICK } from '../../event-constants.ts'
import InputPromptAI from "./input-prompt-ai.ts"
import type { IAudioInput } from "./input-interface.ts"

export const PROMPT_AI_SPEECH_INPUT_ID = "PromptAISpeech"

interface PromptAISpeechOptions {
	language?: string
}

const DEFAULT_OPTIONS: PromptAISpeechOptions = {
	language: "en-US",
}

/**
 * PromptAI Speech Input - Generate MIDI note sequences via AI with speech recognition
 * Extends InputPromptAI to add Web Speech API for voice input detection
 */
export default class InputPromptAISpeech extends InputPromptAI implements IAudioInput {
	#recognition: BrowserSpeechRecognition | null = null
	#isListening: boolean = false
	#language: string
	#promptElement: HTMLElement | null = null

	constructor(options: PromptAISpeechOptions & Record<string, any> = DEFAULT_OPTIONS) {
		super(options)
		this.#language = options.language || DEFAULT_OPTIONS.language!
		this.initializeSpeechRecognition()
	}

	get name(): string {
		return PROMPT_AI_SPEECH_INPUT_ID
	}

	get description(): string {
		return "Speak a musical idea, then generate it with built-in browser AI. Speech recognition may use an online service."
	}

	private initializeSpeechRecognition(): void {
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

		if (!SpeechRecognition) {
			console.warn("Speech Recognition API not available in this browser")
			return
		}

		const recognition: BrowserSpeechRecognition = new SpeechRecognition()
		this.#recognition = recognition
		recognition.lang = this.#language
		recognition.continuous = false
		recognition.interimResults = true

		recognition.onstart = () => {
			this.#isListening = true
			this.updateListeningState(true)
		}

		recognition.onend = () => {
			this.#isListening = false
			this.updateListeningState(false)
		}

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let transcript = ""

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcriptSegment = event.results[i][0].transcript
				transcript += transcriptSegment
			}

			const isFinal = event.results[event.results.length - 1].isFinal

			this.updateTranscript(transcript, isFinal)

			if (isFinal) {
				this.populatePromptAndGenerate(transcript)
			}
		}

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			console.error("Speech recognition error:", event.error)
			this.updateStatus(`Speech error: ${event.error}`, EVENT_ERROR)
			this.#isListening = false
			this.updateListeningState(false)
		}
	}

	async createGui(): Promise<HTMLElement> {
		if (this.#promptElement) return this.#promptElement
		// Create the parent GUI from InputPromptAI
		this.#promptElement = await super.createGui()

		// Add speech input controls
		const container = this.#promptElement.querySelector(".prompt-ai-container")
		if (!container) return this.#promptElement
		const speechHelp = document.createElement('p')
		speechHelp.textContent = 'Speak an idea, then click Generate and play. Speech recognition may use your browser’s online service.'
		container.append(speechHelp)

		// Create speech controls div
		const speechControls = document.createElement("div")
		speechControls.className = "speech-controls"
		speechControls.innerHTML = `
			<button id="start-listening" type="button" class="speech-btn">🎤 Start Listening</button>
			<button id="stop-listening" type="button" class="speech-btn" disabled>⏹ Stop Listening</button>
			<div id="listening-indicator" class="listening-indicator hidden">
				<span class="pulse"></span>
				<span>Listening...</span>
			</div>
			<div id="transcript-preview" class="transcript-preview"></div>
		`

		// Insert speech controls after the textarea
		const promptInput = container.querySelector("#prompt-input")
		if (promptInput) {
			promptInput.parentNode?.insertBefore(speechControls, promptInput.nextSibling)
		}

		// Add event listeners
		const startBtn = this.#promptElement.querySelector("#start-listening") as HTMLButtonElement
		const stopBtn = this.#promptElement.querySelector("#stop-listening") as HTMLButtonElement

		if (startBtn) {
		startBtn.addEventListener(EVENT_CLICK, () => this.startListening())
		}

		if (stopBtn) {
		stopBtn.addEventListener(EVENT_CLICK, () => this.stopListening())
		}

		return this.#promptElement
	}

	private startListening(): void {
		if (!this.#recognition) {
			this.updateStatus("Speech Recognition not available", EVENT_ERROR)
			return
		}

		if (this.#isListening) {
			return
		}

		try {
			this.#recognition.start()
		} catch (error) {
			console.error("Error starting speech recognition:", error)
		}
	}

	private stopListening(): void {
		if (!this.#recognition || !this.#isListening) {
			return
		}

		try {
			this.#recognition.stop()
		} catch (error) {
			console.error("Error stopping speech recognition:", error)
		}
	}

	private updateListeningState(isListening: boolean): void {
		const startBtn = this.#promptElement?.querySelector("#start-listening") as HTMLButtonElement
		const stopBtn = this.#promptElement?.querySelector("#stop-listening") as HTMLButtonElement
		const indicator = this.#promptElement?.querySelector("#listening-indicator") as HTMLElement

		if (startBtn) startBtn.disabled = isListening
		if (stopBtn) stopBtn.disabled = !isListening
		if (indicator) {
			if (isListening) {
				indicator.classList.remove("hidden")
			} else {
				indicator.classList.add("hidden")
			}
		}
	}

	private updateTranscript(transcript: string, isFinal: boolean): void {
		const preview = this.#promptElement?.querySelector("#transcript-preview") as HTMLElement
		if (!preview) return

		preview.textContent = `${isFinal ? 'Recognized' : 'Interim'}: ${transcript}`
	}

	private populatePromptAndGenerate(transcript: string): void {
		const promptInput = this.#promptElement?.querySelector("#prompt-input") as HTMLTextAreaElement
		if (!promptInput) return

		// Populate the text area with the recognized speech
		promptInput.value = transcript

		// Native model creation/download may require a fresh user gesture.
		this.updateStatus('Speech captured. Click Generate and play to use browser AI. Speech recognition may use your browser’s online service.')
	}

	async destroyGui(): Promise<void> {
		this.#recognition?.abort()
		this.#isListening = false
		this.#promptElement = null
		await super.destroyGui()
	}

	override destroy(): void {
		if (this.#recognition) {
			this.#recognition.onresult = null
			this.#recognition.onend = null
			this.#recognition.onstart = null
			this.#recognition.onerror = null
			this.#recognition.abort()
		}
		super.destroy()
	}
}

interface BrowserSpeechRecognition {
	lang: string
	continuous: boolean
	interimResults: boolean
	onstart: (() => void) | null
	onend: (() => void) | null
	onresult: ((event: SpeechRecognitionEvent) => void) | null
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
	start(): void
	stop(): void
	abort(): void
}

// Type declaration for SpeechRecognitionEvent
interface SpeechRecognitionEvent extends Event {
	resultIndex: number
	results: SpeechRecognitionResultList
}

// Type declaration for SpeechRecognitionErrorEvent
interface SpeechRecognitionErrorEvent extends Event {
	error: string
}

// Type declaration for SpeechRecognitionResultList
interface SpeechRecognitionResultList {
	length: number
	[index: number]: SpeechRecognitionResult
	item(index: number): SpeechRecognitionResult
}

// Type declaration for SpeechRecognitionResult
interface SpeechRecognitionResult {
	length: number
	isFinal: boolean
	[index: number]: SpeechRecognitionAlternative
	item(index: number): SpeechRecognitionAlternative
}

// Type declaration for SpeechRecognitionAlternative
interface SpeechRecognitionAlternative {
	transcript: string
	confidence: number
}

declare global {
	interface Window {
		SpeechRecognition: any
		webkitSpeechRecognition: any
	}
}
