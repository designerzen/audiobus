import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer"
import type { IAudioCommand } from "../../audio-command-interface"

export const ID_MELODY_SHADOW = "Melody-Shadow"

export class TransformerMelodyShadow extends PerformanceTransformer {
	type = ID_MELODY_SHADOW
	category = "Variation"
	private history = new Map<string, number[]>()
	get name() {
		return "Melody Shadow"
	}
	get description() {
		return "Play earlier pitches on your current attacks, creating a counterline that borrows your new rhythm."
	}
	get instructions() {
		return "Play a melody. Each new key can also sound the pitch played a few attacks earlier; both voices follow the new key's release. Silence does not advance the memory."
	}
	constructor(config: Settings = {}) {
		super(
			{ lag: 2, transpose: -12, level: 70, dry: 1 },
			[
				{
					name: "lag",
					label: "Remembered attacks back",
					values: numbers(1, 8),
					min: 1,
					max: 8
				},
				{
					name: "transpose",
					label: "Shadow transposition",
					values: [-24, -12, -7, 0, 7, 12, 24],
					min: -48,
					max: 48
				},
				{
					name: "level",
					label: "Shadow velocity (%)",
					values: [25, 50, 70, 85, 100],
					min: 1,
					max: 100
				},
				{ name: "dry", label: "Keep current melody", values: [0, 1], min: 0, max: 1 }
			],
			config
		)
	}
	protected noteOn(voice: Voice): IAudioCommand[] {
		const key = routeKey(voice.input),
			history = this.history.get(key) ?? []
		const previous = history[history.length - Math.round(Number(this.options.lag))]
		history.push(voice.input.number)
		this.history.set(key, history.slice(-8))
		const result = this.options.dry ? [this.start(voice)] : []
		if (previous === undefined) return result
		const pitch = previous + Number(this.options.transpose)
		if (pitch >= 0 && pitch <= 127 && !(this.options.dry && pitch === voice.input.number)) {
			result.push(
				this.start(
					voice,
					pitch,
					this.now,
					(voice.input.velocity * Number(this.options.level)) / 100
				)
			)
		}
		return result
	}
	protected clearState() {
		this.history?.clear()
	}
	protected clearRoute(route: string) {
		this.history.delete(route)
		return []
	}
}