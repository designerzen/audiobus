import {
	PerformanceTransformer,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import { COLLECT_CONTROL, spreadOctaves } from "./chord-loop-transformer.ts"

export const ID_HARP = "Harp"
export class TransformerHarp extends PerformanceTransformer {
	type = ID_HARP
	category = "Timing"
	private chords = new Map<string, Voice[]>()
	get name() {
		return "Harp"
	}
	get description() {
		return "Sweep each chord across several octaves like a hand run over harp strings."
	}
	get instructions() {
		return "Play a chord. Its notes cascade once through the octaves and ring until their keys are released; releasing a key cancels its unheard notes."
	}
	constructor(config: Settings = {}) {
		super(
			{ direction: "up", octaves: 4, speed: 45, falloff: 20, collect: 25 },
			[
				{ name: "direction", label: "Direction", values: ["up", "down", "up-down"] },
				{ name: "octaves", label: "Octaves", values: [1, 2, 3, 4, 5, 6], min: 1, max: 6 },
				{
					name: "speed",
					label: "Time between strings (ms)",
					values: [15, 30, 45, 60, 90, 120, 200],
					min: 1,
					max: 1000
				},
				{
					name: "falloff",
					label: "Velocity falloff (%)",
					values: [0, 10, 20, 30, 50],
					min: 0,
					max: 90
				},
				COLLECT_CONTROL
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const key = routeKey(voice.input)
		let chord = this.chords.get(key)
		if (!chord) {
			chord = []
			this.chords.set(key, chord)
			this.schedule(
				this.now + Number(this.options.collect) / 1000,
				() => this.sweep(key),
				undefined,
				key
			)
		}
		chord.push(voice)
		return []
	}
	private sweep(key: string) {
		const chord = (this.chords.get(key) ?? [])
			.filter((voice) => !voice.released)
			.sort((a, b) => a.input.number - b.input.number)
		this.chords.delete(key)
		let notes = spreadOctaves(chord, Number(this.options.octaves))
		if (this.options.direction === "down") {
			notes.reverse()
		} else if (this.options.direction === "up-down") {
			notes = [...notes, ...notes.slice(0, -1).reverse()]
		}
		for (const [index, { voice, pitch }] of notes.entries()) {
			const velocity =
				voice.input.velocity *
				(1 - ((index / Math.max(1, notes.length - 1)) * Number(this.options.falloff)) / 100)
			this.schedule(
				this.now + (index * Number(this.options.speed)) / 1000,
				() => {
					// A string plucked on the way back down is already ringing, so it is damped first.
					const ringing = voice.targets.find((target) => target.number === pitch)
					const result = ringing ? [this.end(voice, ringing)] : []
					return [...result, this.start(voice, pitch, this.now, velocity)]
				},
				voice
			)
		}
		return []
	}
	protected clearState() {
		this.chords?.clear()
	}
	protected clearRoute(route: string) {
		this.chords.delete(route)
		return []
	}
}