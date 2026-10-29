import {
	PerformanceTransformer,
	copyCommand,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import { CONTROL_CHANGE, NOTE_OFF } from "../../commands"

export const ID_NOTE_MAPPER = "Note-Mapper"
export function parseNoteMap(value: string): Map<number, number[]> {
	const mapping = new Map<number, number[]>()
	if (!value.trim()) {
		return mapping
	}
	for (const entry of value.split(/[;,]/)) {
		const match = entry.trim().match(/^(\d{1,3})\s*[:=]\s*(\d{1,3}(?:\s*\+\s*\d{1,3})*)$/)
		if (!match) {
			throw new Error("Use MIDI note mappings such as 36:48; 38:50+62")
		}
		const source = Number(match[1]),
			targets = [...new Set(match[2].split("+").map(Number))]
		if (source > 127 || targets.some((target) => target > 127)) {
			throw new Error("MIDI notes must be between 0 and 127")
		}
		mapping.set(source, targets)
	}
	return mapping
}
export class TransformerNoteMapper extends PerformanceTransformer {
	type = ID_NOTE_MAPPER
	category = "Routing"
	private mapping = new Map<number, number[]>()
	get name() {
		return "Note Mapper"
	}
	get description() {
		return "Remap drum notes, layer pitches or turn keys into MIDI controller messages."
	}
	constructor(config: Settings = {}) {
		super(
			{
				mapping: "36:36; 38:38; 42:42",
				output: "notes",
				channel: 0,
				unmatched: "pass",
				gain: 100
			},
			[
				{
					name: "mapping",
					label: "Note map",
					help: "MIDI numbers: 36:48; 38:50+62. Use + to layer notes. In CC mode targets are controller numbers."
				},
				{ name: "output", label: "Output messages", values: ["notes", "cc"] },
				{
					name: "channel",
					label: "Output channel",
					values: [{ name: "Follow input", value: 0 }, ...numbers(1, 16)],
					min: 0,
					max: 16
				},
				{ name: "unmatched", label: "Unmapped notes", values: ["pass", "block"] },
				{
					name: "gain",
					label: "Velocity / CC level (%)",
					values: numbers(25, 200, 25),
					min: 0,
					max: 200
				}
			],
			config
		)
		this.mapping = parseNoteMap(String(this.options.mapping))
	}
	override setConfig(key: string, value: unknown) {
		const parsed = key === "mapping" ? parseNoteMap(String(value)) : undefined
		super.setConfig(key, value)
		if (parsed) {
			this.mapping = parsed
		}
	}
	protected noteOn(voice: Voice) {
		const targets = this.mapping.get(voice.input.number)
		if (!targets) {
			return this.options.unmatched === "pass" ? [this.start(voice)] : []
		}
		return targets.map((pitch) => {
			const command = this.start(
				voice,
				pitch,
				this.now,
				(voice.input.velocity * Number(this.options.gain)) / 100
			)
			if (this.options.channel) {
				command.channel = Number(this.options.channel)
			}
			if (this.options.output === "cc") {
				command.type = command.subtype = CONTROL_CHANGE
				command.value = command.velocity
			}
			return command
		})
	}
	protected noteOff(voice: Voice) {
		const targets = [...voice.targets]
		this.release(voice)
		return targets.map((target) =>
			target.type === CONTROL_CHANGE
				? copyCommand(target, { value: 0, startAt: this.now })
				: copyCommand(target, {
						type: NOTE_OFF,
						subtype: NOTE_OFF,
						velocity: 0,
						startAt: this.now
					})
		)
	}
}