import NoteInput from "./note-input"
import { action, bounded, changed, devicePanel, numberControl } from "../device-controls"
import { EVENT_CHANGE, EVENT_CLICK } from "../../event-constants"
import {
	SCALE_EXPLORER_DEFAULTS,
	effectiveScaleSet,
	scaleExplorerControls
} from "../scale-explorer-controls"
import { pitchClasses, pitchSetAnalysis, pitchSetMask } from "../../tuning/pitch-class-set"
import { createMusicalTorus } from "../../ui/musical-torus"

export default class InputScaleExplorer extends NoteInput {
	private playing = false
	private previous?: number
	private position = 0
	private nextStep = 0
	private releaseAt?: number
	private gui?: HTMLElement
	mountRoutes?: (
		host: HTMLElement,
		audition: (mask: number) => Promise<void>,
		status: HTMLElement
	) => void
	get name() {
		return "Scale Explorer"
	}
	get description() {
		return "Audition any twelve-tone pitch set, including all 223 set classes, on the shared transport."
	}

	constructor(options: Record<string, any> = {}) {
		super({ ...SCALE_EXPLORER_DEFAULTS, ...options })
		this.options.mask = pitchSetMask(this.options.mask)
		const controls = scaleExplorerControls()
		for (const key of ["source", "operation"]) {
			const choices = controls.find((control) => control.name === key)!.values!
			if (
				!choices.some(
					(choice) =>
						String(typeof choice === "object" ? choice.value : choice) ===
						String(this.options[key])
				)
			) {
				this.options[key] = SCALE_EXPLORER_DEFAULTS[key]
			}
		}
		for (const [key, fallback, min, max] of [
			["root", 0, 0, 11],
			["mode", 0, 0, 11],
			["octave", 4, -1, 8],
			["velocity", 100, 1, 127],
			["channel", 1, 1, 16]
		] as const) {
			this.options[key] = Math.round(bounded(options[key], fallback, min, max))
		}
		this.options.gate = bounded(options.gate, 0.75, 0.05, 1)
		this.setAsConnected()
	}

	private notes(): number[] {
		const base = (this.options.octave + 1) * 12 + this.options.root
		return pitchClasses(effectiveScaleSet(this.options))
			.map((pitch) => base + pitch)
			.filter((note) => note <= 127)
	}

	startClock(): void {
		this.stopClock()
		this.playing = true
	}
	stopClock(): void {
		this.allNotesOff()
		this.playing = false
		this.previous = undefined
		this.position = this.nextStep = 0
		this.releaseAt = undefined
	}
	updateTime(now: number): void {
		if (!this.playing || !this.isConnected || !Number.isFinite(now)) {
			return
		}
		const bpm = bounded(this.options.getBpm?.(), 120, 10, 400)
		this.position +=
			this.previous === undefined ? 0 : ((Math.max(0, now - this.previous) * bpm) / 60) * 2
		this.previous = now
		if (this.releaseAt !== undefined && this.position >= this.releaseAt) {
			this.allNotesOff()
			this.releaseAt = undefined
		}
		if (this.position + 1e-8 < this.nextStep) {
			return
		}
		const step = Math.floor(this.position + 1e-8)
		this.nextStep = step + 1
		this.allNotesOff()
		const notes = this.notes()
		if (notes.length) {
			this.noteOn(notes[step % notes.length], this.options.velocity, this.options.channel)
			this.releaseAt = step + this.options.gate
		}
	}

	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			help = document.createElement("p"),
			status = document.createElement("p")
		help.textContent =
			"Use transport Play to hear repeating eighth notes. Audition chord plays briefly without transport. Custom pitches are semitones above the tonic, before set operations."
		status.setAttribute("role", "status")
		panel.append(help)
		const selectors = new Map<string, HTMLSelectElement>()
		const torus = createMusicalTorus({
			audition: (pitch) =>
				this.pulse(
					(this.options.octave + 1) * 12 + this.options.root + pitch,
					this.options.velocity,
					400,
					this.options.channel
				),
			toggle: (pitch) => {
				const mask = effectiveScaleSet(this.options)
				this.options.source = "custom"
				this.options.operation = "original"
				this.options.mode = 0
				update("mask", mask ^ (1 << pitch))
			}
		})
		const pitchButtons: HTMLButtonElement[] = []
		let maskInput: HTMLInputElement
		const refresh = () => {
			const mask = effectiveScaleSet(this.options),
				analysis = pitchSetAnalysis(mask)
			torus.update(mask, this.options.root)
			status.textContent = `Result ID ${mask} · ${analysis.pitches.length} notes {${analysis.pitches.join(", ")}} · steps [${analysis.steps.join(", ")}] · interval vector [${analysis.intervals.join(", ")}] · class ${analysis.classId}${mask === 0 ? " · silence" : ""}`
			for (const [name, select] of selectors) {
				select.value = String(this.options[name])
			}
			maskInput.value = String(this.options.mask)
			maskInput.disabled = this.options.source !== "custom"
			const baseMask = pitchSetMask(
				this.options.source === "custom" ? this.options.mask : this.options.source
			)
			pitchButtons.forEach((button, pitch) =>
				button.setAttribute("aria-pressed", String(Boolean(baseMask & (1 << pitch))))
			)
		}
		const update = (name: string, value: string | number) => {
			this.allNotesOff()
			this.options[name] = value
			changed(this)
			refresh()
		}
		for (const control of scaleExplorerControls()) {
			if (control.name === "mask") {
				maskInput = numberControl(
					panel,
					control.label,
					this.options.mask,
					0,
					4095,
					(value) => update("mask", value)
				)
				continue
			}
			const label = document.createElement("label"),
				select = document.createElement("select")
			label.textContent = `${control.label} `
			select.style.maxWidth = "100%"
			for (const choice of control.values!) {
				const option = document.createElement("option")
				option.value = String(typeof choice === "object" ? choice.value : choice)
				option.textContent = String(typeof choice === "object" ? choice.name : choice)
				select.append(option)
			}
			select.title = control.help ?? ""
			select.addEventListener(EVENT_CHANGE, () =>
				update(
					control.name,
					["mode", "root"].includes(control.name) ? Number(select.value) : select.value
				)
			)
			selectors.set(control.name, select)
			label.append(select)
			panel.append(label)
		}
		const pitches = document.createElement("div")
		pitches.style.cssText = "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px"
		for (let pitch = 0; pitch < 12; pitch++) {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = String(pitch)
			button.setAttribute("aria-label", `Custom pitch ${pitch} semitones above tonic`)
			button.addEventListener(EVENT_CLICK, () => {
				// Begin editing the catalogue's base set when leaving a selection.
				if (this.options.source !== "custom") {
					this.options.mask = pitchSetMask(this.options.source)
				}
				this.options.source = "custom"
				update("mask", this.options.mask ^ (1 << pitch))
			})
			pitchButtons.push(button)
			pitches.append(button)
		}
		panel.append(pitches, status, torus.element)
		for (const [key, title, min, max] of [
			["octave", "Octave (C4 = MIDI 60)", -1, 8],
			["velocity", "Velocity", 1, 127],
			["channel", "Channel", 1, 16],
			["gate", "Gate", 0.05, 1]
		] as const) {
			numberControl(
				panel,
				title,
				this.options[key],
				min,
				max,
				(value) => update(key, value),
				key === "gate" ? 0.05 : 1
			)
		}
		action(panel, "Audition chord", () => {
			this.allNotesOff()
			for (const note of this.notes()) {
				this.pulse(note, this.options.velocity, 600, this.options.channel)
			}
		})
		if (this.mountRoutes) {
			const routes = document.createElement("details"),
				summary = document.createElement("summary"),
				host = devicePanel(),
				message = document.createElement("p")
			summary.textContent = "Harmonic routes"
			message.setAttribute("role", "status")
			routes.append(summary, host, message)
			this.mountRoutes(
				host,
				async (mask) => {
					this.allNotesOff()
					for (const pitch of pitchClasses(mask)) {
						const note = (this.options.octave + 1) * 12 + pitch
						if (note <= 127) {
							this.pulse(note, this.options.velocity, 600, this.options.channel)
						}
					}
				},
				message
			)
			panel.append(routes)
		}
		refresh()
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