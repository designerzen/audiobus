import NoteInput from "./note-input"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_FOCUS_OUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_UP,
	EVENT_VISIBILITY_CHANGE
} from "../../event-constants"

const DRUMS = [36, 38, 42, 46, 41, 45, 49, 51]
const CHORDS = [
	[0, 4, 7],
	[2, 5, 9],
	[4, 7, 11],
	[5, 9, 12],
	[7, 11, 14],
	[9, 12, 16],
	[11, 14, 17],
	[12, 16, 19]
]

export default class InputPads extends NoteInput {
	private gui?: HTMLElement
	private events?: AbortController
	private presses = new Map<string, number[]>()
	get name() {
		return "Chord / Drum Pads"
	}
	get description() {
		return "Eight touch and keyboard pads for chords or drums"
	}
	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.mode = options.mode === "drums" ? "drums" : "chords"
		this.options.root = Math.round(bounded(options.root, 60, 0, 108))
		this.options.velocity = Math.round(bounded(options.velocity, 100, 1, 127))
		this.options.channel = Math.round(bounded(options.channel, 1, 1, 16))
		this.setAsConnected()
	}
	press(id: string, index: number, pressure = 0): void {
		if (
			!this.isConnected ||
			this.presses.has(id) ||
			!Number.isInteger(index) ||
			index < 0 ||
			index > 7
		) {
			return
		}
		const notes =
			this.options.mode === "drums"
				? [DRUMS[index]]
				: CHORDS[index].map((n) => n + this.options.root)
		this.presses.set(id, notes)
		const velocity =
			pressure > 0
				? Math.max(1, Math.round(Math.min(1, pressure) * 127))
				: this.options.velocity
		for (const note of notes) {
			this.noteOn(note, velocity, this.options.channel)
		}
	}
	release(id: string): void {
		const notes = this.presses.get(id)
		if (!notes) {
			return
		}
		this.presses.delete(id)
		for (const note of notes) {
			this.noteOff(note, this.options.channel)
		}
	}
	allNotesOff(): void {
		super.allNotesOff()
		this.presses.clear()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			mode = document.createElement("select"),
			label = document.createElement("label")
		this.events = new AbortController()
		const { signal } = this.events
		for (const value of ["chords", "drums"]) {
			const option = document.createElement("option")
			option.value = value
			option.textContent = value
			mode.append(option)
		}
		mode.value = this.options.mode
		mode.addEventListener(
			EVENT_CHANGE,
			() => {
				this.allNotesOff()
				this.options.mode = mode.value
				changed(this)
			},
			{ signal }
		)
		label.append("Pad mode ", mode)
		panel.append(label)
		numberControl(panel, "Root note", this.options.root, 0, 108, (value) => {
			this.allNotesOff()
			this.options.root = value
			changed(this)
		})
		numberControl(panel, "Velocity", this.options.velocity, 1, 127, (value) => {
			this.options.velocity = value
			changed(this)
		})
		numberControl(panel, "Channel", this.options.channel, 1, 16, (value) => {
			this.allNotesOff()
			this.options.channel = value
			changed(this)
		})
		const grid = document.createElement("div")
		grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:8px"
		for (let i = 0; i < 8; i++) {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = `Pad ${i + 1}`
			button.style.cssText = "min-height:64px;touch-action:none"
			button.addEventListener(
				EVENT_POINTER_DOWN,
				(event) => {
					if (event.button !== 0) {
						return
					}
					event.preventDefault()
					button.setPointerCapture?.(event.pointerId)
					this.press(
						`pointer:${event.pointerId}`,
						i,
						event.pointerType === "mouse" ? 0 : event.pressure
					)
				},
				{ signal }
			)
			for (const type of [
				EVENT_POINTER_UP,
				EVENT_POINTER_CANCEL,
				EVENT_LOST_POINTER_CAPTURE
			]) {
				button.addEventListener(
					type,
					(event) => {
						this.release(`pointer:${(event as PointerEvent).pointerId}`)
					},
					{ signal }
				)
			}
			button.addEventListener(
				EVENT_KEY_DOWN,
				(event) => {
					if (!["Enter", " "].includes(event.key)) {
						return
					}
					event.preventDefault()
					if (!event.repeat) {
						this.press(`key:${event.key}`, i)
					}
				},
				{ signal }
			)
			button.addEventListener(EVENT_FOCUS_OUT, () => this.allNotesOff(), { signal })
			grid.append(button)
		}
		window.addEventListener(EVENT_KEY_UP, (event) => this.release(`key:${event.key}`), {
			signal
		})
		window.addEventListener(EVENT_BLUR, () => this.allNotesOff(), { signal })
		document.addEventListener(
			EVENT_VISIBILITY_CHANGE,
			() => {
				if (document.hidden) {
					this.allNotesOff()
				}
			},
			{ signal }
		)
		panel.append(grid)
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.allNotesOff()
		this.events?.abort()
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		void this.destroyGui()
		super.destroy()
	}
}