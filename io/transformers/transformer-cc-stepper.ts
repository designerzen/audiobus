import {
	PerformanceTransformer,
	beatSeconds,
	clamp,
	copyCommand,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import { CONTROL_CHANGE } from "../../commands"

export const ID_CC_STEPPER = "CC-Stepper"
interface PendingCC {
	command: IAudioCommand
	route: string
}
export class TransformerCCStepper extends PerformanceTransformer {
	type = ID_CC_STEPPER
	category = "Modulation"
	private pending = new Map<string, PendingCC>()
	get name() {
		return "CC Stepper"
	}
	get description() {
		return "Quantise controller values and optionally send the latest value on a tempo-synced grid."
	}
	constructor(config: Settings = {}) {
		super(
			{ lower: 1, upper: 1, levels: 8, beats: 0, offset: 0 },
			[
				{
					name: "lower",
					label: "Lowest affected CC",
					values: numbers(0, 119),
					min: 0,
					max: 119
				},
				{
					name: "upper",
					label: "Highest affected CC",
					values: numbers(0, 119),
					min: 0,
					max: 119
				},
				{
					name: "levels",
					label: "Value levels",
					values: [2, 3, 4, 5, 8, 16, 32, 64, 128],
					min: 2,
					max: 128
				},
				{
					name: "beats",
					label: "Time grid (beats)",
					values: [{ name: "No time grid", value: 0 }, 0.125, 0.25, 0.5, 1, 2, 4],
					min: 0,
					max: 4
				},
				{
					name: "offset",
					label: "Grid offset (%)",
					values: [0, 25, 50, 75],
					min: 0,
					max: 99
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		return [this.start(voice)]
	}
	protected other(command: IAudioCommand) {
		if (
			command.type !== CONTROL_CHANGE ||
			command.number < Math.min(Number(this.options.lower), Number(this.options.upper)) ||
			command.number > Math.max(Number(this.options.lower), Number(this.options.upper))
		) {
			return [command]
		}
		const steps = Math.round(Number(this.options.levels)) - 1
		const value = Math.round(
			(Math.round((clamp(command.value, 0, 127) / 127) * steps) / steps) * 127
		)
		const mapped = copyCommand(command, { value })
		const interval = beatSeconds(this.timer) * Number(this.options.beats)
		if (interval <= 0) {
			return [mapped]
		}
		const offset = (interval * Number(this.options.offset)) / 100
		const at = Math.ceil((this.now - offset - 1e-9) / interval) * interval + offset
		const route = routeKey(command),
			key = `${route}:${command.number}`
		const existing = this.pending.get(key)
		if (existing) {
			existing.command = mapped
			return []
		}
		if (at <= this.now + 1e-9) {
			return [mapped]
		}
		const pending = { command: mapped, route }
		this.pending.set(key, pending)
		this.schedule(
			at,
			() => {
				if (this.pending.get(key) !== pending) {
					return []
				}
				this.pending.delete(key)
				return [copyCommand(pending.command, { startAt: this.now })]
			},
			undefined,
			route
		)
		return []
	}
	protected clearState() {
		this.pending?.clear()
	}
	protected clearRoute(route: string) {
		for (const [key, pending] of this.pending) {
			if (pending.route === route) {
				this.pending.delete(key)
			}
		}
		return []
	}
}