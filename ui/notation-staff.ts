/**
 * Musical Notation Staff Display Component
 *
 * A reusable component that renders a musical staff with notes
 * at their correct vertical positions. Supports treble clef notation.
 */

interface NotationStaffConfig {
	width?: number
	height?: number
	lineColor?: string
	ledgerLineColor?: string
	noteColor?: string
	backgroundColor?: string
	staffLineCount?: number
	lineSpacing?: number
	noteRadius?: number
	staffPadding?: number
}

interface StaffNote {
	noteNumber: number
	velocity: number
}

export class NotationStaff {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private config: Required<NotationStaffConfig>
	private activeNotes: Map<number, StaffNote> = new Map()

	constructor(container: HTMLElement, config: NotationStaffConfig = {}) {
		// Default configuration
		this.config = {
			width: config.width ?? 800,
			height: config.height ?? 200,
			lineColor: config.lineColor ?? "#333",
			ledgerLineColor: config.ledgerLineColor ?? "#999",
			noteColor: config.noteColor ?? "#333",
			backgroundColor: config.backgroundColor ?? "#f9f9f9",
			staffLineCount: config.staffLineCount ?? 5,
			lineSpacing: config.lineSpacing ?? 12,
			noteRadius: config.noteRadius ?? 6,
			staffPadding: config.staffPadding ?? 40,
		}

		// Create canvas
		this.canvas = document.createElement("canvas")
		this.canvas.width = this.config.width
		this.canvas.height = this.config.height
		this.canvas.style.display = "block"
		this.canvas.style.border = "1px solid #ccc"
		this.canvas.style.borderRadius = "4px"
		this.canvas.style.backgroundColor = this.config.backgroundColor

		container.appendChild(this.canvas)

		const ctx = this.canvas.getContext("2d")
		if (!ctx) {
			throw new Error("Failed to get canvas 2D context")
		}
		this.ctx = ctx

		this.render()
	}

	/**
	 * Add a note to be displayed
	 */
	noteOn(noteNumber: number, velocity: number = 127): void {
		this.activeNotes.set(noteNumber, {
			noteNumber,
			velocity: Math.max(0, Math.min(127, velocity)),
		})
		this.render()
	}

	/**
	 * Remove a note from display
	 */
	noteOff(noteNumber: number): void {
		this.activeNotes.delete(noteNumber)
		this.render()
	}

	/**
	 * Clear all notes
	 */
	clearNotes(): void {
		this.activeNotes.clear()
		this.render()
	}

	/**
	 * Get all active notes
	 */
	getActiveNotes(): StaffNote[] {
		return Array.from(this.activeNotes.values())
	}

	/**
	 * Render the staff and notes
	 */
	render(): void {
		const { width, height } = this.config

		// Clear canvas
		this.ctx.fillStyle = this.config.backgroundColor
		this.ctx.fillRect(0, 0, width, height)

		// Draw components
		this.drawStaff()
		this.drawNotes()
	}

	/**
	 * Draw the musical staff lines and ledger lines
	 */
	private drawStaff(): void {
		const { width, height, staffLineCount, lineSpacing, staffPadding, lineColor, ledgerLineColor } = this.config

		const topMargin = height / 2 - (staffLineCount - 1) * lineSpacing / 2
		const bottomLine = topMargin + (staffLineCount - 1) * lineSpacing
		const topLine = topMargin

		// Draw main staff lines
		this.ctx.strokeStyle = lineColor
		this.ctx.lineWidth = 1.5

		for (let i = 0; i < staffLineCount; i++) {
			const y = topMargin + i * lineSpacing
			this.ctx.beginPath()
			this.ctx.moveTo(staffPadding, y)
			this.ctx.lineTo(width - staffPadding, y)
			this.ctx.stroke()
		}

		// Draw ledger lines for extended range
		this.ctx.lineWidth = 1
		this.ctx.strokeStyle = ledgerLineColor

		// Below staff (lower notes)
		for (let i = 1; i <= 3; i++) {
			const y = bottomLine + i * lineSpacing
			this.ctx.beginPath()
			this.ctx.moveTo(staffPadding, y)
			this.ctx.lineTo(width - staffPadding, y)
			this.ctx.stroke()
		}

		// Above staff (higher notes)
		for (let i = 1; i <= 3; i++) {
			const y = topLine - i * lineSpacing
			this.ctx.beginPath()
			this.ctx.moveTo(staffPadding, y)
			this.ctx.lineTo(width - staffPadding, y)
			this.ctx.stroke()
		}

		// Draw treble clef
		this.drawTrebleClef(staffPadding / 2, topMargin)
	}

	/**
	 * Draw treble clef symbol
	 */
	private drawTrebleClef(x: number, topMargin: number): void {
		const { lineSpacing, noteColor } = this.config
		const y = topMargin + lineSpacing * 2 // G line

		this.ctx.fillStyle = noteColor
		this.ctx.font = "24px serif"
		this.ctx.textAlign = "center"
		this.ctx.textBaseline = "middle"
		this.ctx.fillText("𝄞", x, y)
	}

	/**
	 * Draw all active notes on the staff
	 */
	private drawNotes(): void {
		const { height, staffLineCount, lineSpacing } = this.config

		const topMargin = height / 2 - (staffLineCount - 1) * lineSpacing / 2

		// Group notes by Y position to handle simultaneous notes
		const notesByY: Map<number, StaffNote[]> = new Map()

		for (const note of this.activeNotes.values()) {
			const y = this.getNoteYPosition(note.noteNumber, topMargin)

			if (!notesByY.has(y)) {
				notesByY.set(y, [])
			}
			notesByY.get(y)!.push(note)
		}

		// Draw notes, arranging simultaneous notes horizontally
		const centerX = this.canvas.width / 2
		for (const [y, notes] of notesByY) {
			// Distribute notes horizontally if multiple at same pitch
			const xStart = centerX - ((notes.length - 1) * 20) / 2
			for (let i = 0; i < notes.length; i++) {
				const x = xStart + i * 20
				const opacity = notes[i].velocity / 127
				this.drawNote(x, y, notes[i].noteNumber, opacity)
			}
		}
	}

	/**
	 * Calculate the Y position for a note on the staff
	 * Uses treble clef: E4 is on the bottom line
	 */
	private getNoteYPosition(noteNumber: number, topMargin: number): number {
		const { lineSpacing } = this.config

		// Treble clef reference: E4 (MIDI 64) on line 1
		// Each semitone = lineSpacing/2
		const E4 = 64
		const semitoneDistance = (noteNumber - E4) * (lineSpacing / 2)
		const E4Position = topMargin + lineSpacing * 4

		return E4Position - semitoneDistance
	}

	/**
	 * Draw a single note head with stem
	 */
	private drawNote(x: number, y: number, noteNumber: number, opacity: number): void {
		const { noteRadius, noteColor } = this.config

		this.ctx.globalAlpha = opacity
		this.ctx.fillStyle = noteColor

		// Draw note head (filled circle)
		this.ctx.beginPath()
		this.ctx.arc(x, y, noteRadius, 0, Math.PI * 2)
		this.ctx.fill()

		// Draw stem
		this.ctx.strokeStyle = noteColor
		this.ctx.lineWidth = 1.5
		this.ctx.beginPath()
		this.ctx.moveTo(x + noteRadius, y)
		this.ctx.lineTo(x + noteRadius, y - 35)
		this.ctx.stroke()

		this.ctx.globalAlpha = 1
	}

	/**
	 * Get the canvas element
	 */
	getCanvas(): HTMLCanvasElement {
		return this.canvas
	}

	/**
	 * Resize the staff
	 */
	resize(width: number, height: number): void {
		this.config.width = width
		this.config.height = height
		this.canvas.width = width
		this.canvas.height = height
		this.render()
	}

	/**
	 * Destroy the component
	 */
	destroy(): void {
		if (this.canvas.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas)
		}
		this.activeNotes.clear()
	}
}
