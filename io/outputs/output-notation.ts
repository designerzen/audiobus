import type { IAudioOutput } from "./output-interface.ts"
import { convertNoteNumberToColour } from "../../conversion/note-to-colour.ts"

/**
 * Musical Notation Output
 *
 * Displays notes on a musical staff (stave) with proper vertical positioning
 * based on pitch. Multiple simultaneous notes are displayed horizontally.
 *
 * @example
 * const notation = new OutputNotation()
 * await notation.connect()
 * notation.noteOn(60, 1.0) // Middle C
 * notation.noteOff(60)
 */
export default class OutputNotation implements IAudioOutput {
	
	static ID: number = 0

	#uuid: string
	#name: string = "Notation Output"
	#isConnected: boolean = false
	#container: HTMLElement | null = null
	#canvas: HTMLCanvasElement | null = null
	#ctx: CanvasRenderingContext2D | null = null
	#activeNotes: Map<number, { noteNumber: number; velocity: number }> = new Map()

	// Staff configuration
	#staffLineCount: number = 5
	#lineSpacing: number = 12
	#noteRadius: number = 6
	#staffPadding: number = 40
	#containerHeight: number = 200
	#containerWidth: number = 400

	// Clef types: treble, alto, bass
	#clefType: "treble" | "bass" = "treble"
	// Reference note for the clef (e.g., treble clef: G4=67, bass clef: F3=41)
	#clefReferenceNote: number = 67 // G4 for treble
	#clefReferencePosition: number = 1 // Line 2 (counting from top: 0, 1, 2, 3, 4)

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return this.#name
	}

	get description(): string {
		return "Displays notes on a musical staff"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	get canvas(): HTMLCanvasElement | null {
		return this.#canvas
	}

	constructor() {
		this.#uuid = "Output-Notation-" + OutputNotation.ID++
	}

	/**
	 * Create the GUI (canvas and staff display)
	 */
	async createGui(): Promise<HTMLElement> {
		// Create container
		this.#container = document.createElement("div")
		this.#container.id = this.#uuid
		this.#container.style.width = this.#containerWidth + "px"
		this.#container.style.height = this.#containerHeight + "px"
		this.#container.style.border = "1px solid #ccc"
		this.#container.style.borderRadius = "4px"
		this.#container.style.backgroundColor = "#f9f9f9"
		this.#container.style.overflow = "hidden"

		// Create canvas
		this.#canvas = document.createElement("canvas")
		this.#canvas.width = this.#containerWidth
		this.#canvas.height = this.#containerHeight
		this.#canvas.style.display = "block"
		this.#canvas.style.width = "100%"
		this.#canvas.style.height = "100%"
		this.#container.appendChild(this.#canvas)

		this.#ctx = this.#canvas.getContext("2d")
		if (!this.#ctx) {
			throw new Error("Failed to get canvas 2D context")
		}

		this.#render()
		return this.#container
	}

	/**
	 * Destroy the GUI
	 */
	async destroyGui(): Promise<void> {
		if (this.#canvas && this.#container && this.#container.contains(this.#canvas)) {
			this.#container.removeChild(this.#canvas)
		}

		if (this.#container && this.#container.parentElement) {
			this.#container.parentElement.removeChild(this.#container)
		}

		this.#canvas = null
		this.#ctx = null
		this.#container = null
	}

	reset(): void {
		try {
			this.allNotesOff()
			this.destroyGui()
			this.#isConnected = false
			console.info("Notation output disconnected")
		} catch (error) {
			console.error("Error disconnecting Notation output:", error)
		}
	}
	
	/**
	 * Start playing a note
	 * @param noteNumber MIDI note number (0-127)
	 * @param velocity Normalized velocity (0-1)
	 */
	noteOn(noteNumber: number, velocity: number = 1.0): void {
		const midiNote = Math.round(noteNumber)
		const clampedVelocity = Math.max(0, Math.min(1, velocity))
		this.#activeNotes.set(midiNote, { noteNumber: midiNote, velocity: clampedVelocity })
		console.log(`Note ON: ${midiNote}, velocity: ${clampedVelocity}`)
		this.#render()
	}

	/**
	 * Stop playing a note
	 */
	noteOff(noteNumber: number): void {
		const midiNote = Math.round(noteNumber)
		this.#activeNotes.delete(midiNote)
		console.log(`Note OFF: ${midiNote}, active notes:`, Array.from(this.#activeNotes.keys()))
		this.#render()
	}

	/**
	 * Stop all notes
	 */
	allNotesOff(): void {
		this.#activeNotes.clear()
		console.log("All notes off")
		this.#render()
	}

	/**
	 * Get active notes
	 */
	getActiveNotes(): Array<{ noteNumber: number; velocity: number }> {
		return Array.from(this.#activeNotes.values())
	}

	/**
	 * Determine the appropriate clef based on active notes
	 */
	#determineClef(): void {
		if (this.#activeNotes.size === 0) {
			this.#clefType = "treble"
			return
		}

		const noteNumbers = Array.from(this.#activeNotes.keys())
		const minNote = Math.min(...noteNumbers)
		const maxNote = Math.max(...noteNumbers)
		const midpoint = (minNote + maxNote) / 2

		// Treble clef covers roughly C4 (60) to C6 (84)
		// Bass clef covers roughly C2 (36) to C4 (60)
		// Switch to bass if the average note is below middle C (C4=60)
		if (midpoint < 60) {
			this.#clefType = "bass"
			this.#clefReferenceNote = 41 // F3
			this.#clefReferencePosition = 3 // Line 4
		} else {
			this.#clefType = "treble"
			this.#clefReferenceNote = 67 // G4
			this.#clefReferencePosition = 1 // Line 2
		}
	}

	/**
	 * Render the staff and notes
	 */
	#render(): void {
		if (!this.#canvas || !this.#ctx){ 
			return
		}

		// Determine the best clef for current notes
		this.#determineClef()

		const ctx = this.#ctx
		const width = this.#canvas.width
		const height = this.#canvas.height

		// Clear canvas
		ctx.fillStyle = "#f9f9f9"
		ctx.fillRect(0, 0, width, height)

		// Draw staff
		this.#drawStaff(ctx, width, height)

		// Draw notes
		this.#drawNotes(ctx, width, height)
	}

	/**
	 * Draw the musical staff
	 */
	#drawStaff(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		const topMargin = height / 2 - (this.#staffLineCount - 1) * this.#lineSpacing / 2
		const lineColor = "#333"
		const ledgerLineColor = "#999"

		ctx.strokeStyle = lineColor
		ctx.lineWidth = 1.5

		// Draw staff lines
		for (let i = 0; i < this.#staffLineCount; i++) {
			const y = topMargin + i * this.#lineSpacing
			ctx.beginPath()
			ctx.moveTo(this.#staffPadding, y)
			ctx.lineTo(width - this.#staffPadding, y)
			ctx.stroke()
		}

		// Draw ledger lines for high and low notes
		ctx.lineWidth = 1
		ctx.strokeStyle = ledgerLineColor

		const bottomLine = topMargin + (this.#staffLineCount - 1) * this.#lineSpacing
		const topLine = topMargin

		// Below staff
		for (let i = 1; i <= 3; i++) {
			const y = bottomLine + i * this.#lineSpacing
			ctx.beginPath()
			ctx.moveTo(this.#staffPadding, y)
			ctx.lineTo(width - this.#staffPadding, y)
			ctx.stroke()
		}

		// Above staff
		for (let i = 1; i <= 3; i++) {
			const y = topLine - i * this.#lineSpacing
			ctx.beginPath()
			ctx.moveTo(this.#staffPadding, y)
			ctx.lineTo(width - this.#staffPadding, y)
			ctx.stroke()
		}

		// Draw clef (treble clef symbol)
		this.#drawTrebleClef(ctx, this.#staffPadding / 2, topMargin)
	}

	/**
	 * Draw the clef symbol (treble or bass)
	 */
	#drawTrebleClef(ctx: CanvasRenderingContext2D, x: number, topMargin: number): void {
		let y: number
		let clefSymbol: string

		if (this.#clefType === "bass") {
			// Bass clef symbol on line 4
			y = topMargin + this.#lineSpacing * 3
			clefSymbol = "𝄢"
		} else {
			// Treble clef symbol on line 2
			y = topMargin + this.#lineSpacing * 1
			clefSymbol = "𝄞"
		}

		ctx.fillStyle = "#333"
		ctx.font = "24px serif"
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"
		ctx.fillText(clefSymbol, x, y)
	}

	/**
	 * Draw notes on the staff
	 */
	#drawNotes(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		const topMargin = height / 2 - (this.#staffLineCount - 1) * this.#lineSpacing / 2
		const bottomMargin = topMargin + (this.#staffLineCount - 1) * this.#lineSpacing

		// Group notes by their vertical position
		const notesByY: Map<number, Array<{ note: number; velocity: number }>> = new Map()

		// Treble clef: Middle C is C4 (MIDI note 60)
		// Standard treble clef positions (from bottom to top):
		// E4=64 (line 1), F4=65 (space), G4=67 (line 2), A4=69 (space), B4=71 (line 3), C5=72 (space), D5=74 (line 4), E5=76 (space), F5=77 (line 5)
		// C4=60 (below staff)

		console.log(`Drawing ${this.#activeNotes.size} notes, topMargin: ${topMargin}, height: ${height}`)

		for (const { noteNumber, velocity } of this.#activeNotes.values()) {
			const y = this.#getNoteYPosition(noteNumber, topMargin)
			console.log(`Note ${noteNumber}: y position = ${y}`)

			if (!notesByY.has(y)) {
				notesByY.set(y, [])
			}
			notesByY.get(y)!.push({ note: noteNumber, velocity })
		}

		console.log(`Notes grouped by Y position: ${notesByY.size} positions`)

		// Draw notes grouped by Y position
		for (const [y, notes] of notesByY) {
			// Arrange multiple notes horizontally at the same pitch
			const xStart = width / 2 - ((notes.length - 1) * 20) / 2
			for (let i = 0; i < notes.length; i++) {
				const x = xStart + i * 20
				// Velocity is normalized (0-1), ensure at least 0.3 opacity for visibility
				const opacity = Math.max(0.3, notes[i].velocity)
				console.log(`Drawing note at x: ${x}, y: ${y}, velocity: ${notes[i].velocity}, opacity: ${opacity}`)
				this.#drawNote(ctx, x, y, notes[i].note, opacity)
			}
		}
	}

	/**
	 * Calculate Y position for a note number on the staff
	 * Works with both treble and bass clefs
	 */
	#getNoteYPosition(noteNumber: number, topMargin: number): number {
		// Each semitone = lineSpacing/2 vertically
		// The clef reference note defines where a specific note sits on the staff

		const semitoneDistance = (noteNumber - this.#clefReferenceNote) * (this.#lineSpacing / 2)
		const referencePosition = topMargin + this.#clefReferencePosition * this.#lineSpacing

		// Subtract distance because higher notes move up (negative Y)
		return referencePosition - semitoneDistance
	}

	/**
	 * Draw a single note head with pitch-based coloring
	 */
	#drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, noteNumber: number, opacity: number): void {
		ctx.save()
		ctx.globalAlpha = opacity

		// Get color based on note number and velocity
		const noteColor = convertNoteNumberToColour(noteNumber, 12, opacity)
		ctx.fillStyle = noteColor
		ctx.strokeStyle = noteColor
		ctx.lineWidth = 1.5

		// Draw note head (filled circle)
		ctx.beginPath()
		ctx.arc(x, y, this.#noteRadius, 0, Math.PI * 2)
		ctx.fill()

		// Draw stem
		ctx.beginPath()
		ctx.moveTo(x + this.#noteRadius, y)
		ctx.lineTo(x + this.#noteRadius, y - 35)
		ctx.stroke()

		ctx.restore()
	}
}
