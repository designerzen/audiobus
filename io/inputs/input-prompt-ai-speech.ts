import InputPromptAI, { PROMPT_AI_INPUT_ID } from "./input-prompt-ai.ts"
import type { IAudioInput } from "./input-interface.ts"

export const PROMPT_AI_SPEECH_INPUT_ID = "PromptAISpeech"

interface PromptAISpeechOptions {
	apiKey?: string
	model?: string
	temperature?: number
	maxTokens?: number
	language?: string
}

const DEFAULT_OPTIONS: PromptAISpeechOptions = {
	model: "gpt-3.5-turbo",
	temperature: 0.7,
	maxTokens: 500,
	language: "en-US",
}

/**
 * PromptAI Speech Input - Generate MIDI note sequences via AI with speech recognition
 * Extends InputPromptAI to add Web Speech API for voice input detection
 */
export default class InputPromptAISpeech extends InputPromptAI implements IAudioInput {
	#recognition: (SpeechRecognition | webkitSpeechRecognition) | null = null
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
		return "AI-powered prompt input with speech recognition for generating note sequences via voice"
	}

	private initializeSpeechRecognition(): void {
		const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

		if (!SpeechRecognition) {
			console.warn("Speech Recognition API not available in this browser")
			return
		}

		this.#recognition = new SpeechRecognition()
		this.#recognition.language = this.#language
		this.#recognition.continuous = false
		this.#recognition.interimResults = true

		this.#recognition.onstart = () => {
			this.#isListening = true
			this.updateListeningState(true)
		}

		this.#recognition.onend = () => {
			this.#isListening = false
			this.updateListeningState(false)
		}

		this.#recognition.onresult = (event: SpeechRecognitionEvent) => {
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

		this.#recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			console.error("Speech recognition error:", event.error)
			this.updateStatus(`Speech error: ${event.error}`, "error")
			this.#isListening = false
			this.updateListeningState(false)
		}
	}

	async createGui(): Promise<HTMLElement> {
		// Create the parent GUI from InputPromptAI
		this.#promptElement = await super.createGui()

		// Add speech input controls
		const container = this.#promptElement.querySelector(".prompt-ai-container")
		if (!container) return this.#promptElement

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
			startBtn.addEventListener("click", () => this.startListening())
		}

		if (stopBtn) {
			stopBtn.addEventListener("click", () => this.stopListening())
		}

		return this.#promptElement
	}

	private startListening(): void {
		if (!this.#recognition) {
			this.updateStatus("Speech Recognition not available", "error")
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

		preview.innerHTML = `
			<div class="transcript ${isFinal ? "final" : "interim"}">
				<strong>${isFinal ? "Recognized:" : "Interim:"}</strong>
				<p>${transcript}</p>
			</div>
		`
	}

	private populatePromptAndGenerate(transcript: string): void {
		const promptInput = this.#promptElement?.querySelector("#prompt-input") as HTMLTextAreaElement
		if (!promptInput) return

		// Populate the text area with the recognized speech
		promptInput.value = transcript

		// Automatically generate sequence from the speech input
		const generateBtn = this.#promptElement?.querySelector("#generate-sequence") as HTMLButtonElement
		if (generateBtn) {
			// Use setTimeout to ensure the textarea is updated before triggering generation
			setTimeout(() => {
				generateBtn.click()
			}, 100)
		}
	}

	protected updateStatus(message: string, type: "success" | "error" | "info" = "info"): void {
		const statusEl = this.#promptElement?.querySelector("#generation-status") as HTMLElement
		if (!statusEl) return

		statusEl.textContent = message
		statusEl.className = `status-message status-${type}`
	}

	override destroy(): void {
		this.stopListening()
		super.destroy()
	}
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
