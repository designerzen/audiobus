import AbstractInput from "./abstract-input"
import type { IAudioCommand } from "../../audio-command-interface"
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from "../../commands"
import { clipCommand, musicalCommand, parseEventClip } from "../event-clip"
import { changed, devicePanel } from "../device-controls"
import { EVENT_CHANGE } from "../../event-constants"

export default class InputEventLoop extends AbstractInput {
	private playing = false
	private origin?: number
	private cursor = 0
	private cycle = 0
	private held = new Map<string, IAudioCommand>()
	private channels = new Set<number>()
	private gui?: HTMLElement
	get name() {
		return "Event Loop"
	}
	get description() {
		return "Replay a captured musical-event loop through this chain"
	}
	hasMidiInput() {
		return true
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
		const clip = parseEventClip({
			version: 1,
			duration: options.duration ?? 1,
			commands: options.commands ?? []
		})
		this.options.commands = clip.commands
		this.options.duration = clip.duration
		this.setAsConnected()
	}
	load(value: unknown): void {
		const clip = parseEventClip(value)
		this.stopClock()
		this.options.commands = clip.commands
		this.options.duration = clip.duration
		changed(this)
	}
	startClock(): void {
		this.stopClock()
		this.playing = true
	}
	stopClock(): void {
		this.releaseNotes()
		this.playing = false
		this.origin = undefined
		this.cursor = 0
		this.cycle = 0
	}
	private releaseNotes(): void {
		for (const command of this.held.values()) {
			this.dispatch(
				musicalCommand({
					...command,
					type: NOTE_OFF,
					velocity: 0,
					from: this.uuid,
					startAt: this.now,
					time: this.now
				})
			)
		}
		for (const channel of this.channels) {
			this.dispatch(
				musicalCommand({
					type: CONTROL_CHANGE,
					channel,
					number: 64,
					value: 0,
					from: this.uuid,
					startAt: this.now,
					time: this.now
				})
			)
		}
		this.held.clear()
		this.channels.clear()
	}
	updateTime(now: number): void {
		if (
			!this.isConnected ||
			!this.playing ||
			!Number.isFinite(now) ||
			!this.options.commands.length
		) {
			return
		}
		this.origin ??= now
		const duration = this.options.duration,
			elapsed = Math.max(0, now - this.origin)
		const cycle = Math.floor(elapsed / duration)
		if (cycle !== this.cycle) {
			this.releaseNotes()
			this.cursor = 0
			this.cycle = cycle
		}
		const commands: IAudioCommand[] = this.options.commands
		while (
			this.cursor < commands.length &&
			commands[this.cursor].startAt <= elapsed - cycle * duration + 1e-8
		) {
			const source = commands[this.cursor++]
			const command = clipCommand(source, this.origin + cycle * duration + source.startAt)
			command.from = this.uuid
			command.time = now
			const key = `${command.channel}:${command.number}`
			if (command.type === NOTE_ON && command.velocity > 0) {
				this.held.set(key, command)
			} else if (command.type === NOTE_OFF || command.type === NOTE_ON) {
				this.held.delete(key)
			}
			if (command.type === CONTROL_CHANGE) {
				this.channels.add(command.channel)
			}
			this.dispatch(command)
		}
	}
	async connect(): Promise<void> {
		this.setAsConnected()
	}
	async disconnect(): Promise<void> {
		this.stopClock()
		this.setAsDisconnected()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			label = document.createElement("label"),
			file = document.createElement("input"),
			status = document.createElement("p")
		file.type = "file"
		file.accept = ".json,application/json"
		status.setAttribute("role", "status")
		status.textContent = `${this.options.commands.length} events loaded. Use transport Stop, then Play.`
		file.addEventListener(EVENT_CHANGE, async () => {
			const selected = file.files?.[0]
			if (!selected) {
				return
			}
			try {
				if (selected.size > 8 * 1024 * 1024) {
					throw new Error("Event loop exceeds 8 MB")
				}
				this.load(JSON.parse(await selected.text()))
				status.textContent = `${this.options.commands.length} events loaded. Use transport Stop, then Play.`
			} catch (error) {
				status.textContent = error instanceof Error ? error.message : String(error)
			}
			file.value = ""
		})
		label.append("Load event loop ", file)
		panel.append(label, status)
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		this.stopClock()
		this.setAsDisconnected()
		void this.destroyGui()
	}
}