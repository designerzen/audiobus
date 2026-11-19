import type { IAudioCommand } from "../../commands/audio-command-interface"
import {
	NOTE_ON,
	NOTE_OFF,
	CONTROL_CHANGE,
	PROGRAM_CHANGE,
	PITCH_BEND
} from "../../commands/commands"
import {
	CHANNEL_PRESSURE,
	POLYPHONIC_PRESSURE,
	commandToMidi
} from "../../midi/midi-command-conversion"
import { Transformer, type TransformerConfig } from "./abstract-transformer"
import type { FieldConfig } from "./interface-transformer"

export const ID_MIDI_TRANSFORMER = "MIDITransformer"
interface Config extends TransformerConfig {
	transpose: number
	notes: number
	controllers: number
	programs: number
	pitchBend: number
	pressure: number
	system: number
}
const DEFAULTS: Config = {
	transpose: 0,
	notes: 1,
	controllers: 1,
	programs: 1,
	pitchBend: 1,
	pressure: 1,
	system: 1
}
const GROUPS: [keyof Config, string][] = [
	["notes", "Notes"],
	["controllers", "Control changes"],
	["programs", "Program changes"],
	["pitchBend", "Pitch bend"],
	["pressure", "Aftertouch"],
	["system", "System / SysEx / clock"]
]
export interface MidiLogEntry {
	time: number
	type: string
	channel: number
	input: number[]
	output?: number[]
}

export class TransformerMidi extends Transformer<Config> {
	type = ID_MIDI_TRANSFORMER
	protected category = "MIDI"
	readonly handlesMidiControls = true
	private entries: MidiLogEntry[] = []
	// Retain the decision and pitch until release, even if settings change mid-note.
	private held = new Map<string, (number | null)[]>()
	private log?: HTMLPreElement
	private gui?: HTMLElement
	private redraw?: ReturnType<typeof setTimeout>

	get name() {
		return "MIDI Transformer"
	}
	get description() {
		return "Transpose notes, filter MIDI message types, and inspect a rolling MIDI log."
	}
	get fields(): FieldConfig[] {
		return [
			{
				name: "transpose",
				label: "Transpose (semitones)",
				type: "number",
				min: -48,
				max: 48,
				step: 1,
				default: 0
			},
			...GROUPS.map(([name, label]) => ({
				name,
				label,
				type: "select",
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				],
				default: 1
			}))
		]
	}
	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULTS, ...config })
	}
	get logEntries(): readonly MidiLogEntry[] {
		return this.entries
	}
	clearLog(): void {
		this.entries = []
		this.renderLog()
	}

	private passes(command: IAudioCommand): boolean {
		const group =
			command.type === NOTE_ON || command.type === NOTE_OFF
				? "notes"
				: command.type === CONTROL_CHANGE
					? "controllers"
					: command.type === PROGRAM_CHANGE
						? "programs"
						: command.type === PITCH_BEND
							? "pitchBend"
							: command.type === CHANNEL_PRESSURE ||
								  command.type === POLYPHONIC_PRESSURE
								? "pressure"
								: "system"
		return Boolean(Number(this.config[group]))
	}
	transform(commands: IAudioCommand[]): IAudioCommand[] {
		const distance = this.config.enabled ? Math.round(Number(this.config.transpose) || 0) : 0
		const result: IAudioCommand[] = []
		for (const command of commands) {
			let output: IAudioCommand | undefined =
				!this.config.enabled || this.passes(command) ? command : undefined
			const key = `${command.inputId ?? command.from}:${command.midiGroup ?? 0}:${command.channel}:${command.number}`
			if (command.type === NOTE_ON || command.type === NOTE_OFF) {
				const held = this.held.get(key) ?? []
				let pitch: number | null
				if (command.type === NOTE_ON) {
					const transposed = command.number + distance
					pitch = output && transposed >= 0 && transposed <= 127 ? transposed : null
					held.push(pitch)
					this.held.set(key, held)
				} else {
					pitch = held.length ? held.shift()! : output ? command.number + distance : null
					if (!held.length) {
						this.held.delete(key)
					}
				}
				output =
					pitch !== null && pitch >= 0 && pitch <= 127
						? { ...command, number: pitch }
						: undefined
			} else if (output && command.type === POLYPHONIC_PRESSURE) {
				const pitch = command.number + distance
				output = pitch >= 0 && pitch <= 127 ? { ...command, number: pitch } : undefined
			}
			if (output) {
				result.push(output)
			}
			this.entries.push({
				time: command.time ?? command.startAt ?? 0,
				type: command.type,
				channel: command.channel,
				input: commandToMidi(command) ?? [],
				output: output ? commandToMidi(output) : undefined
			})
		}
		this.entries = this.entries.slice(-200)
		if (this.log && !this.redraw) {
			this.redraw = setTimeout(() => {
				this.redraw = undefined
				this.renderLog()
			}, 50)
		}
		return result
	}
	private renderLog(): void {
		if (!this.log) {
			return
		}
		const hex = (bytes: number[]) =>
			bytes.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ")
		this.log.textContent =
			this.entries
				.map(
					(entry) =>
						`${entry.time.toFixed(3)} ${entry.channel ? `Ch ${entry.channel}` : "System"} ${entry.type} ${hex(entry.input)} → ${entry.output ? hex(entry.output) : "FILTERED"}`
				)
				.join("\n") || "Waiting for MIDI…"
		this.log.scrollTop = this.log.scrollHeight
	}
	async createGui(): Promise<HTMLElement> {
		if (!this.gui) {
			const gui = document.createElement("div")
			gui.append(await super.createGui())
			const clear = document.createElement("button")
			clear.type = "button"
			clear.textContent = "Clear MIDI log"
			clear.onclick = () => this.clearLog()
			this.log = document.createElement("pre")
			this.log.setAttribute("aria-label", "Rolling MIDI log (latest 200 messages)")
			this.log.tabIndex = 0
			Object.assign(this.log.style, {
				maxHeight: "16rem",
				maxWidth: "100%",
				overflow: "auto",
				fontSize: "0.75rem"
			})
			gui.append(clear, this.log)
			this.gui = gui
			this.renderLog()
		}
		return this.gui
	}
	destroyGui(): void {
		if (this.redraw) {
			clearTimeout(this.redraw)
		}
		this.redraw = undefined
		this.gui?.remove()
		this.gui = undefined
		this.log = undefined
		super.destroyGui()
	}
	reset(): void {
		this.held.clear()
	}
}