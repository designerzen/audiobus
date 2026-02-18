import AbstractInput from "./abstract-input.ts"
import AudioCommand from "../../audio-command.ts"
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from '../../commands'
import NoteModel from "../../note-model.ts"

import type { IAudioInput } from "./input-interface.ts"

export const PROMPT_AI_INPUT_ID = "PromptAI"

interface PromptAIOptions {
	apiKey?: string
	model?: string
	temperature?: number
	maxTokens?: number
}

const DEFAULT_OPTIONS: PromptAIOptions = {
	model: "gpt-3.5-turbo",
	temperature: 0.7,
	maxTokens: 500,
}

/**
 * PromptAI Input - Generate MIDI note sequences via AI prompting
 * Allows users to describe note combinations and sequences that are generated using an LLM
 */
export default class InputPromptAI extends AbstractInput implements IAudioInput {
	#apiKey: string
	#model: string
	#temperature: number
	#maxTokens: number
	#promptElement: HTMLElement | null = null
	#isGenerating: boolean = false

	get name(): string {
		return PROMPT_AI_INPUT_ID
	}

	get description(): string {
		return "AI-powered prompt input for generating note sequences and combinations"
	}

	get isHidden(): boolean {
		return false
	}

	constructor(options: PromptAIOptions & Record<string, any> = DEFAULT_OPTIONS) {
		super({ ...DEFAULT_OPTIONS, ...options })
		this.#apiKey = options.apiKey || ""
		this.#model = options.model || DEFAULT_OPTIONS.model!
		this.#temperature = options.temperature ?? DEFAULT_OPTIONS.temperature!
		this.#maxTokens = options.maxTokens || DEFAULT_OPTIONS.maxTokens!
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		const container = document.querySelector("main")

		if (container === null) {
			throw new Error("Could not find main container element")
		}

		const promptPanel = document.createElement("div")
		promptPanel.className = "prompt-ai-panel"
		promptPanel.innerHTML = `
			<div class="prompt-ai-container">
				<h3>PromptAI Generator</h3>
				<textarea 
					id="prompt-input" 
					placeholder="Describe the notes or sequence you want (e.g., 'C major scale ascending', 'pentatonic minor pattern')"
					rows="4"
				></textarea>
				<div class="prompt-controls">
					<button id="generate-sequence" type="button">Generate Sequence</button>
					<button id="stop-generation" type="button" disabled>Stop</button>
				</div>
				<div id="generation-status" class="status-message"></div>
				<div id="generated-notes" class="generated-notes"></div>
			</div>
		`

		this.#promptElement = container.appendChild(promptPanel)

		// Setup event listeners
		const generateBtn = this.#promptElement.querySelector("#generate-sequence") as HTMLButtonElement
		const stopBtn = this.#promptElement.querySelector("#stop-generation") as HTMLButtonElement
		const promptInput = this.#promptElement.querySelector("#prompt-input") as HTMLTextAreaElement

		generateBtn.addEventListener("click", () => this.generateSequenceFromPrompt(promptInput.value))
		stopBtn.addEventListener("click", () => this.stopGeneration())

		return this.#promptElement
	}

	async destroyGui(): Promise<void> {
		if (this.#promptElement !== null) {
			this.#promptElement.remove()
		}
		return Promise.resolve()
	}

	private async generateSequenceFromPrompt(prompt: string): Promise<void> {
		if (!prompt.trim()) {
			this.updateStatus("Please enter a prompt", "error")
			return
		}

		if (!this.#apiKey) {
			this.updateStatus("API key not configured", "error")
			return
		}

		this.#isGenerating = true
		this.updateGenerateButtonState(true)

		try {
			const notes = await this.callAIApi(prompt)
			await this.dispatchNoteSequence(notes)
			this.displayGeneratedNotes(notes)
			this.updateStatus("Sequence generated successfully", "success")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			this.updateStatus(`Failed to generate: ${errorMessage}`, "error")
			console.error("PromptAI generation error:", error)
		} finally {
			this.#isGenerating = false
			this.updateGenerateButtonState(false)
		}
	}

	private async callAIApi(prompt: string): Promise<number[]> {
		const systemPrompt = `You are a music generation assistant. Given a description, respond with ONLY a JSON array of MIDI note numbers (0-127) that matches the description. 
Examples:
- "C major scale" -> [60, 62, 64, 65, 67, 69, 71, 72]
- "C minor chord" -> [60, 63, 67]
- "pentatonic pattern" -> [60, 62, 64, 67, 69]

Always respond with valid JSON array format. No explanations, just the array.`

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.#apiKey}`,
			},
			body: JSON.stringify({
				model: this.#model,
				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: this.#temperature,
				max_tokens: this.#maxTokens,
			}),
		})

		if (!response.ok) {
			const errorData = await response.json()
			throw new Error(`API Error: ${errorData.error?.message || response.statusText}`)
		}

		const data = await response.json()
		const content = data.choices[0]?.message?.content

		if (!content) {
			throw new Error("No response from API")
		}

		// Parse JSON array from response
		const jsonMatch = content.match(/\[\d+(?:\s*,\s*\d+)*\]/)
		if (!jsonMatch) {
			throw new Error("Could not parse note numbers from response")
		}

		const notes = JSON.parse(jsonMatch[0]) as number[]

		// Validate note numbers
		if (!Array.isArray(notes) || !notes.every((n) => typeof n === "number" && n >= 0 && n <= 127)) {
			throw new Error("Invalid note numbers in response")
		}

		return notes
	}

	private async dispatchNoteSequence(notes: number[]): Promise<void> {
		const startTime = this.now
		const noteDuration = 500 // milliseconds

		for (let i = 0; i < notes.length; i++) {
			const noteNumber = notes[i]
			const noteTime = startTime + i * noteDuration

			// Note ON
			const noteOnCommand = new AudioCommand()
			noteOnCommand.type = NOTE_ON
			noteOnCommand.velocity = 100
			noteOnCommand.number = noteNumber
			noteOnCommand.from = PROMPT_AI_INPUT_ID
			noteOnCommand.startAt = noteTime
			noteOnCommand.time = noteTime

			this.dispatch(noteOnCommand)

			// Note OFF after duration
			const noteOffCommand = new AudioCommand()
			noteOffCommand.type = NOTE_OFF
			noteOffCommand.velocity = 0
			noteOffCommand.number = noteNumber
			noteOffCommand.from = PROMPT_AI_INPUT_ID
			noteOffCommand.startAt = noteTime + noteDuration
			noteOffCommand.time = noteTime + noteDuration

			this.dispatch(noteOffCommand)

			// Small delay between dispatches
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}

	private displayGeneratedNotes(notes: number[]): void {
		const notesDisplay = this.#promptElement?.querySelector("#generated-notes") as HTMLElement
		if (!notesDisplay) return

		const noteNames = notes.map((n) => new NoteModel(n).toString())
		notesDisplay.innerHTML = `
			<div class="notes-list">
				<strong>Generated Notes:</strong>
				<div class="notes-grid">${noteNames.map((name) => `<span class="note-tag">${name}</span>`).join("")}</div>
			</div>
		`
	}

	private updateStatus(message: string, type: "success" | "error" | "info" = "info"): void {
		const statusEl = this.#promptElement?.querySelector("#generation-status") as HTMLElement
		if (!statusEl) return

		statusEl.textContent = message
		statusEl.className = `status-message status-${type}`
	}

	private updateGenerateButtonState(isGenerating: boolean): void {
		const generateBtn = this.#promptElement?.querySelector("#generate-sequence") as HTMLButtonElement
		const stopBtn = this.#promptElement?.querySelector("#stop-generation") as HTMLButtonElement

		if (generateBtn) generateBtn.disabled = isGenerating
		if (stopBtn) stopBtn.disabled = !isGenerating
	}

	private stopGeneration(): void {
		this.#isGenerating = false
		this.updateGenerateButtonState(false)
		this.updateStatus("Generation stopped", "info")
	}

	override destroy(): void {
		this.stopGeneration()
		this.setAsDisconnected()
	}

	hasMidiInput(): boolean {
		return true
	}
}




