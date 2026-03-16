import AbstractInput from "./abstract-input.ts"
import AudioCommand from "../../audio-command.ts"
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from "../../commands"
import NoteModel from "../../note-model.ts"

import type { IAudioInput } from "./input-interface.ts"

const MUSIC_MOUSE_INPUT_ID = "MusicMouse"

const DEFAULT_OPTIONS = {
	rootNote: 60, // C4
	scale: [0, 2, 4, 5, 7, 9, 11, 12], // Major scale (C D E F G A B C)
	octaves: 3, // Number of octaves in vertical axis
	containerSelector: "body",
}

interface MusicMouseOptions extends Record<string, any> {
	rootNote?: number
	scale?: number[]
	octaves?: number
	containerSelector?: string
}

/**
 * Music Mouse input - cursor-controlled instrument inspired by Laurie Spiegel's original
 * Mouse X position controls horizontal pitch movement, Y position controls octave/register
 * Uses a musical scale to ensure harmonically coherent output
 */
export default class InputMusicMouse extends AbstractInput implements IAudioInput {
	#containerElement: HTMLElement | null = null
	#canvas: HTMLCanvasElement | null = null
	#context: CanvasRenderingContext2D | null = null
	#scale: number[]
	#rootNote: number
	#octaves: number
	#containerSelector: string
	#isActive: boolean = false
	#lastNoteNumber: number = -1
	#lastVelocity: number = 0
	#mouseX: number = 0
	#mouseY: number = 0
	#gridWidth: number = 0
	#gridHeight: number = 0

	get name(): string {
		return MUSIC_MOUSE_INPUT_ID
	}

	get description(): string {
		return "Music Mouse - Cursor-controlled pitch and octave input"
	}

	get isHidden(): boolean {
		return false
	}

	constructor(options: MusicMouseOptions = DEFAULT_OPTIONS) {
		super({ ...DEFAULT_OPTIONS, ...options })
		this.#scale = this.options.scale
		this.#rootNote = this.options.rootNote
		this.#octaves = this.options.octaves
		this.#containerSelector = this.options.containerSelector

		this.onMouseMove = this.onMouseMove.bind(this)
		this.onMouseEnter = this.onMouseEnter.bind(this)
		this.onMouseLeave = this.onMouseLeave.bind(this)

		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		// Create canvas
		this.#canvas = document.createElement("canvas")
		this.#canvas.id = "music-mouse-canvas"
		this.#canvas.style.width = "100%"
		this.#canvas.style.height = "400px"
		this.#canvas.style.border = "1px solid #ccc"
		this.#canvas.style.cursor = "crosshair"
		this.#canvas.style.display = "block"
		this.#canvas.style.backgroundColor = "#f0f0f0"

		// Set initial canvas resolution
		this.#canvas.width = 800
		this.#canvas.height = 400

		this.#context = this.#canvas.getContext("2d")
		if (this.#context) {
			this.#context.scale(window.devicePixelRatio, window.devicePixelRatio)
		}

		this.#gridWidth = 800 / window.devicePixelRatio
		this.#gridHeight = 400 / window.devicePixelRatio

		// Add event listeners
		this.#canvas.addEventListener("mousemove", this.onMouseMove)
		this.#canvas.addEventListener("mouseenter", this.onMouseEnter)
		this.#canvas.addEventListener("mouseleave", this.onMouseLeave)

		// Initial draw
		this.draw()

		this.#containerElement = this.#canvas
		return this.#canvas
	}

	async destroyGui(): Promise<void> {
		if (this.#canvas) {
			this.#canvas.removeEventListener("mousemove", this.onMouseMove)
			this.#canvas.removeEventListener("mouseenter", this.onMouseEnter)
			this.#canvas.removeEventListener("mouseleave", this.onMouseLeave)
			this.#canvas.remove()
			this.#canvas = null
		}
		return Promise.resolve()
	}

	override destroy(): void {
		this.allNotesOff()
		this.setAsDisconnected()
	}

	private onMouseEnter(): void {
		this.#isActive = true
	}

	private onMouseLeave(): void {
		this.allNotesOff()
		this.#isActive = false
	}

	private onMouseMove(event: MouseEvent): void {
		if (!this.#canvas || !this.#isActive) return

		const rect = this.#canvas.getBoundingClientRect()
		this.#mouseX = event.clientX - rect.left
		this.#mouseY = event.clientY - rect.top

		// Clamp to canvas bounds
		this.#mouseX = Math.max(0, Math.min(this.#gridWidth, this.#mouseX))
		this.#mouseY = Math.max(0, Math.min(this.#gridHeight, this.#mouseY))

		// Calculate note number from position
		const noteNumber = this.calculateNoteFromPosition(this.#mouseX, this.#mouseY)
		const velocity = this.calculateVelocityFromPosition(this.#mouseX, this.#mouseY)

		// Send note off if different note
		if (noteNumber !== this.#lastNoteNumber && this.#lastNoteNumber >= 0) {
			this.sendNoteOff(this.#lastNoteNumber, this.#lastVelocity)
		}

		// Send note on if note changed
		if (noteNumber !== this.#lastNoteNumber) {
			this.sendNoteOn(noteNumber, velocity)
			this.#lastNoteNumber = noteNumber
			this.#lastVelocity = velocity
		}

		this.draw()
	}

	private calculateNoteFromPosition(x: number, y: number): number {
		// X position: determines position within scale
		const scaleIndex = Math.floor((x / this.#gridWidth) * this.#scale.length)
		const constrainedScaleIndex = Math.max(0, Math.min(this.#scale.length - 1, scaleIndex))
		const noteInScale = this.#scale[constrainedScaleIndex]

		// Y position: determines octave
		const octaveIndex = Math.floor((y / this.#gridHeight) * this.#octaves)
		const constrainedOctave = Math.max(0, Math.min(this.#octaves - 1, octaveIndex))

		return this.#rootNote + noteInScale + constrainedOctave * 12
	}

	private calculateVelocityFromPosition(x: number, y: number): number {
		// Use horizontal distance from left/right edges for velocity
		const distanceFromLeft = x
		const distanceFromRight = this.#gridWidth - x
		const minDistance = Math.min(distanceFromLeft, distanceFromRight)
		const maxDistance = this.#gridWidth / 2

		// Velocity is higher in center, lower at edges
		const velocity = Math.round((minDistance / maxDistance) * 100)
		return Math.max(1, Math.min(127, velocity))
	}

	private sendNoteOn(noteNumber: number, velocity: number): void {
		const command = new AudioCommand()
		command.type = NOTE_ON
		command.velocity = velocity
		command.number = noteNumber
		command.from = MUSIC_MOUSE_INPUT_ID
		command.startAt = this.now
		command.time = this.now
		this.dispatch(command)
	}

	private sendNoteOff(noteNumber: number, velocity: number): void {
		const command = new AudioCommand()
		command.type = NOTE_OFF
		command.number = noteNumber
		command.velocity = velocity
		command.from = MUSIC_MOUSE_INPUT_ID
		command.startAt = this.now
		command.time = this.now
		this.dispatch(command)
	}

	private allNotesOff(): void {
		if (this.#lastNoteNumber >= 0) {
			this.sendNoteOff(this.#lastNoteNumber, this.#lastVelocity)
			this.#lastNoteNumber = -1
		}
	}

	private draw(): void {
		if (!this.#context || !this.#canvas) return

		const ctx = this.#context
		const width = this.#gridWidth
		const height = this.#gridHeight

		// Clear canvas
		ctx.fillStyle = "#f0f0f0"
		ctx.fillRect(0, 0, width, height)

		// Draw grid
		ctx.strokeStyle = "#ddd"
		ctx.lineWidth = 1

		// Vertical lines (scale divisions)
		const scaleStepWidth = width / this.#scale.length
		for (let i = 1; i < this.#scale.length; i++) {
			const x = i * scaleStepWidth
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, height)
			ctx.stroke()
		}

		// Horizontal lines (octave divisions)
		const octaveStepHeight = height / this.#octaves
		for (let i = 1; i < this.#octaves; i++) {
			const y = i * octaveStepHeight
			ctx.beginPath()
			ctx.moveTo(0, y)
			ctx.lineTo(width, y)
			ctx.stroke()
		}

		// Draw cursor position if active
		if (this.#isActive) {
			ctx.fillStyle = "rgba(100, 150, 255, 0.8)"
			ctx.beginPath()
			ctx.arc(this.#mouseX, this.#mouseY, 8, 0, Math.PI * 2)
			ctx.fill()

			// Draw crosshair
			ctx.strokeStyle = "rgba(100, 150, 255, 0.5)"
			ctx.lineWidth = 1
			ctx.beginPath()
			ctx.moveTo(this.#mouseX, 0)
			ctx.lineTo(this.#mouseX, height)
			ctx.stroke()

			ctx.beginPath()
			ctx.moveTo(0, this.#mouseY)
			ctx.lineTo(width, this.#mouseY)
			ctx.stroke()

			// Draw note info
			const noteNumber = this.calculateNoteFromPosition(this.#mouseX, this.#mouseY)
			const note = new NoteModel(noteNumber)
			const velocity = this.calculateVelocityFromPosition(this.#mouseX, this.#mouseY)

			ctx.fillStyle = "#000"
			ctx.font = "14px sans-serif"
			ctx.fillText(
				`${note.name}${Math.floor(note.octave)} (${noteNumber}) | Vel: ${velocity}`,
				10,
				20
			)
		} else {
			// Draw instructions when not active
			ctx.fillStyle = "#999"
			ctx.font = "14px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("Move mouse to play", width / 2, height / 2)
		}

		// Draw scale name
		const scaleNames: Record<string, string> = {
			"0,2,4,5,7,9,11,12": "Major",
			"0,2,3,5,7,8,10,12": "Natural Minor",
			"0,2,3,5,7,8,11,12": "Harmonic Minor",
			"0,3,5,6,7,10,12": "Pentatonic",
		}

		const scaleKey = this.#scale.join(",")
		const scaleName = scaleNames[scaleKey] || "Custom"

		ctx.fillStyle = "#666"
		ctx.font = "12px sans-serif"
		ctx.textAlign = "left"
		ctx.fillText(`Scale: ${scaleName} | Root: ${new NoteModel(this.#rootNote).name}`, 10, height - 10)
	}
}
