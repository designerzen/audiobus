import type { IAudioCommand } from "../../audio-command-interface"
import type { IAudioOutput } from "./output-interface"
import { NOTE_OFF, NOTE_ON } from "../../commands"
import { action, devicePanel } from "../device-controls"
import { musicalCommand } from "../event-clip"

const SVG_NS = "http://www.w3.org/2000/svg"
interface PlayedNote {
	number: number
	channel: number
	start: number
	end?: number
	velocity: number
}

export default class OutputNoteMonitor implements IAudioOutput {
	readonly uuid = `Output-NoteMonitor-${crypto.randomUUID()}`
	readonly name = "Piano Roll / Note Monitor"
	readonly description = "View transformed pitches, channels, velocities and note durations"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	private connected = true
	private notes: PlayedNote[] = []
	private held = new Map<string, PlayedNote>()
	private gui?: HTMLElement
	private svg?: SVGSVGElement
	private summary?: HTMLElement
	private frame = 0
	private lastDraw = 0
	get isConnected() {
		return this.connected
	}
	private get now(): number {
		return this.options.now?.() ?? performance.now() / 1000
	}
	constructor(readonly options: Record<string, any> = {}) {}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	sendCommand(command: IAudioCommand): void {
		if (
			!this.connected ||
			!Number.isInteger(command.number) ||
			command.number < 0 ||
			command.number > 127
		) {
			return
		}
		const key = this.getNoteKey(command)
		if (command.type === NOTE_ON && command.velocity > 0) {
			const previous = this.held.get(key)
			if (previous) {
				previous.end = this.now
			}
			const note = {
				number: command.number,
				channel: command.channel,
				start: this.now,
				velocity: command.velocity
			}
			this.held.set(key, note)
			this.notes.push(note)
			if (this.notes.length > 256) {
				this.notes.shift()
			}
		} else if (command.type === NOTE_OFF || command.type === NOTE_ON) {
			const note = this.held.get(key)
			if (note) {
				note.end = this.now
			}
			this.held.delete(key)
		}
		this.draw()
	}
	noteOn(number: number, velocity: number): void {
		this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		this.sendCommand(musicalCommand({ type: NOTE_OFF, number, velocity: 0, channel: 1 }))
	}
	allNotesOff(): void {
		for (const note of this.held.values()) {
			note.end = this.now
		}
		this.held.clear()
		this.draw()
	}
	private draw(): void {
		if (!this.svg || !this.summary) {
			return
		}
		this.summary.textContent = this.held.size
			? [...this.held.values()]
					.map((n) => `Note ${n.number}, channel ${n.channel}, velocity ${n.velocity}`)
					.join("; ")
			: "No held notes"
		const nodes: SVGElement[] = [],
			now = this.now,
			windowStart = now - 8
		for (let note = 0; note < 128; note += 12) {
			const line = document.createElementNS(SVG_NS, "line")
			line.setAttribute("x1", "0")
			line.setAttribute("x2", "640")
			line.setAttribute("y1", String((127 - note) * 2))
			line.setAttribute("y2", String((127 - note) * 2))
			line.setAttribute("stroke", "currentColor")
			line.setAttribute("opacity", "0.15")
			nodes.push(line)
		}
		for (const note of this.notes) {
			const end = note.end ?? now
			if (end < windowStart || note.start > now) {
				continue
			}
			const rectangle = document.createElementNS(SVG_NS, "rect"),
				title = document.createElementNS(SVG_NS, "title")
			const x = Math.max(0, (note.start - windowStart) * 80)
			rectangle.setAttribute("x", String(x))
			rectangle.setAttribute("y", String((127 - note.number) * 2))
			rectangle.setAttribute(
				"width",
				String(Math.max(2, (Math.min(now, end) - windowStart) * 80 - x))
			)
			rectangle.setAttribute("height", "2")
			rectangle.setAttribute("fill", `hsl(${((note.channel ?? 1) * 47) % 360} 70% 55%)`)
			title.textContent = `Note ${note.number}, channel ${note.channel}, velocity ${note.velocity}, ${(end - note.start).toFixed(2)} s`
			rectangle.append(title)
			nodes.push(rectangle)
		}
		this.svg.replaceChildren(...nodes)
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		this.summary = document.createElement("p")
		this.svg = document.createElementNS(SVG_NS, "svg")
		this.svg.setAttribute("viewBox", "0 0 640 256")
		this.svg.setAttribute("role", "img")
		this.svg.setAttribute(
			"aria-label",
			"Piano roll: eight seconds of transformed notes; high pitches at the top"
		)
		this.svg.style.cssText = "width:100%;min-width:220px;height:256px"
		panel.append(this.summary, this.svg)
		action(panel, "Clear history", () => {
			this.notes = [...this.held.values()]
			this.draw()
		})
		const animate = (timestamp: number) => {
			if (timestamp - this.lastDraw >= 100) {
				this.lastDraw = timestamp
				this.draw()
			}
			this.frame = requestAnimationFrame(animate)
		}
		this.frame = requestAnimationFrame(animate)
		this.draw()
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		cancelAnimationFrame(this.frame)
		this.gui?.remove()
		this.gui = undefined
		this.svg = undefined
		this.summary = undefined
	}
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.connected = false
	}
	async connect(): Promise<void> {
		this.connected = true
	}
	destroy(): void {
		void this.disconnect()
		void this.destroyGui()
		this.notes = []
	}
}