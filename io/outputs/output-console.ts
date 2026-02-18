import type { IAudioOutput } from "./output-interface.ts"
import { noteNumberToName } from "../../conversion/note-to-name.ts"
import { convertNoteNumberToColour } from "../../conversion/note-to-colour.ts"

export default class OutputConsole extends EventTarget implements IAudioOutput{

	static ID:number = 0

	#uuid:string
	#activeNotes: Map<number, number> = new Map() // noteNumber -> velocity
	#container: HTMLElement | null = null

	get uuid(): string {
		return this.#uuid
	}

	get name():string {
		return "Console"
	}

	get description():string {
		return "Outputs notes to the console and displays active notes"
	}

	get isConnected(): boolean {
		return true
	}

	get isHidden(): boolean {
		return false
	}

	constructor() {
		super()
		this.#uuid = "Output-Console-"+(OutputConsole.ID++)
	}

	
	hasMidiOutput(): boolean {
		return false
	}
	hasAudioOutput(): boolean {
		return false
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
	 * Create GUI container showing active notes
	 */
	async createGui(): Promise<HTMLElement> {
		this.#container = document.createElement("div")
		this.#container.id = this.#uuid
		this.#container.style.padding = "12px"
		this.#container.style.borderRadius = "4px"
		this.#container.style.backgroundColor = "#f0f0f0"
		this.#container.style.fontFamily = "monospace"
		this.#container.style.fontSize = "14px"
		this.#container.style.minHeight = "40px"
		this.#container.style.display = "flex"
		this.#container.style.flexWrap = "wrap"
		this.#container.style.gap = "8px"
		this.#container.style.alignContent = "flex-start"

		this.#render()
		return this.#container
	}

	/**
	 * Destroy GUI container
	 */
	async destroyGui(): Promise<void> {
		if (this.#container && this.#container.parentElement) {
			this.#container.parentElement.removeChild(this.#container)
		}
		this.#container = null
		this.#activeNotes.clear()
	}

	/**
	 * Render active notes in the container
	 */
	#render(): void {
		if (!this.#container) return

		this.#container.innerHTML = ""

		if (this.#activeNotes.size === 0) {
			this.#container.textContent = "No active notes"
			this.#container.style.color = "#999"
			return
		}

		this.#container.style.color = "#333"

		// Sort notes by note number and display them
		const sortedNotes = Array.from(this.#activeNotes.entries())
			.sort(([noteA], [noteB]) => noteA - noteB)

		sortedNotes.forEach(([noteNumber, velocity]) => {
			const noteName = noteNumberToName(noteNumber)
			const noteColor = convertNoteNumberToColour(noteNumber, 12, velocity)
			const badge = document.createElement("div")
			badge.style.padding = "4px 8px"
			badge.style.backgroundColor = noteColor
			badge.style.color = "#fff"
			badge.style.textShadow = "0 1px 2px rgba(0,0,0,0.3)"
			badge.style.borderRadius = "3px"
			badge.style.fontSize = "12px"
			badge.style.fontWeight = "bold"
			badge.style.border = "1px solid rgba(0,0,0,0.2)"
			badge.title = `Note ${noteNumber}, Velocity ${(velocity * 127).toFixed(0)}`
			badge.textContent = `${noteName} (${(velocity * 127).toFixed(0)})`
			this.#container!.appendChild(badge)
		})
	}

	noteOn(noteNumber:number, velocity: number): void {
		const normalizedVelocity = velocity > 1 ? velocity / 127 : velocity
		this.#activeNotes.set(noteNumber, normalizedVelocity)
		console.info(this.uuid, "Note ON: " + noteNumber + " velocity: " + velocity)
		this.#render()
	}

	noteOff(noteNumber: number): void {
		this.#activeNotes.delete(noteNumber)
		console.info(this.uuid, "Note OFF: " + noteNumber)
		this.#render()
	}

	allNotesOff(): void {
		this.#activeNotes.clear()
		console.info(this.uuid, "ALL Notes OFF.")
		this.#render()
	}
}
