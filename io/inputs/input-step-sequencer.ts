import NoteInput from "./note-input"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import { EVENT_CHANGE } from "../../event-constants"

export default class InputStepSequencer extends NoteInput {
	private playing = false
	private previous?: number
	private position = 0
	private nextStep = 0
	private releaseAt?: number
	private gui?: HTMLElement
	get name() {
		return "Step Sequencer"
	}
	get description() {
		return "A repeating sixteen-step note pattern on the shared transport"
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.steps = Array.from({ length: 16 }, (_, i) => {
			const value = options.steps?.[i]
			if (value === null || (value === undefined && i % 4 !== 0)) {
				return null
			}
			return Math.round(bounded(value, 60, 0, 127))
		})
		this.options.velocity = Math.round(bounded(options.velocity, 100, 1, 127))
		this.options.channel = Math.round(bounded(options.channel, 1, 1, 16))
		this.options.gate = bounded(options.gate, 0.75, 0.05, 1)
		this.setAsConnected()
	}

	startClock(): void {
		this.stopClock()
		this.playing = true
	}
	stopClock(): void {
		this.allNotesOff()
		this.playing = false
		this.previous = undefined
		this.position = 0
		this.nextStep = 0
		this.releaseAt = undefined
	}

	updateTime(now: number): void {
		if (!this.playing || !this.isConnected || !Number.isFinite(now)) {
			return
		}
		const bpm = bounded(this.options.getBpm?.(), 120, 10, 400)
		const delta =
			this.previous === undefined ? 0 : ((Math.max(0, now - this.previous) * bpm) / 60) * 4
		this.previous = now
		this.position += delta
		if (this.releaseAt !== undefined && this.position >= this.releaseAt) {
			this.allNotesOff()
			this.releaseAt = undefined
		}
		if (this.position + 1e-8 < this.nextStep) {
			return
		}
		// Resume at the current step after a stalled tab, without a burst of missed notes.
		const step = Math.floor(this.position + 1e-8)
		this.nextStep = step + 1
		this.allNotesOff()
		const note = this.options.steps[step % 16]
		if (note !== null) {
			this.noteOn(note, this.options.velocity, this.options.channel)
			this.releaseAt = step + this.options.gate
		}
	}

	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			grid = document.createElement("div")
		const help = document.createElement("p")
		help.textContent = "Sixteenth notes. Clear a step for a rest. Use transport Play / Stop."
		panel.append(help)
		grid.style.cssText = "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px"
		this.options.steps.forEach((note: number | null, i: number) => {
			const label = document.createElement("label"),
				input = document.createElement("input")
			label.textContent = `Step ${i + 1}`
			input.type = "number"
			input.min = "0"
			input.max = "127"
			input.placeholder = "Rest"
			input.style.width = "100%"
			input.value = note === null ? "" : String(note)
			input.addEventListener(EVENT_CHANGE, () => {
				this.allNotesOff()
				this.options.steps[i] =
					input.value.trim() && Number.isFinite(input.valueAsNumber)
						? Math.round(bounded(input.valueAsNumber, 60, 0, 127))
						: null
				input.value = this.options.steps[i] === null ? "" : String(this.options.steps[i])
				changed(this)
			})
			label.append(input)
			grid.append(label)
		})
		panel.append(grid)
		numberControl(panel, "Velocity", this.options.velocity, 1, 127, (value) => {
			this.options.velocity = value
			changed(this)
		})
		numberControl(panel, "Channel", this.options.channel, 1, 16, (value) => {
			this.allNotesOff()
			this.options.channel = value
			changed(this)
		})
		numberControl(
			panel,
			"Gate",
			this.options.gate,
			0.05,
			1,
			(value) => {
				this.options.gate = value
				changed(this)
			},
			0.05
		)
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
	}
	async disconnect(): Promise<void> {
		this.stopClock()
		await super.disconnect()
	}
	destroy(): void {
		this.stopClock()
		void this.destroyGui()
		super.destroy()
	}
}