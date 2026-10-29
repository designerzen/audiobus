import {
	PerformanceTransformer,
	clamp,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"

export const ID_VELOCITY_SHAPER = "Velocity-Shaper"
export class TransformerVelocityShaper extends PerformanceTransformer {
	type = ID_VELOCITY_SHAPER
	category = "Variation"
	get name() {
		return "Velocity Shaper"
	}
	get description() {
		return "Shape playing dynamics with a velocity curve, limits and gentle variation."
	}
	constructor(config: Settings = {}) {
		super(
			{ curve: 1, minimum: 1, maximum: 127, fixed: 0, variation: 0 },
			[
				{
					name: "curve",
					label: "Response curve",
					values: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4],
					min: 0.25,
					max: 4,
					help: "Below 1 lifts soft playing; above 1 softens it."
				},
				{
					name: "minimum",
					label: "Minimum velocity",
					values: numbers(1, 127),
					min: 1,
					max: 127
				},
				{
					name: "maximum",
					label: "Maximum velocity",
					values: numbers(1, 127),
					min: 1,
					max: 127
				},
				{
					name: "fixed",
					label: "Fixed velocity",
					values: [{ name: "Follow playing", value: 0 }, ...numbers(1, 127)],
					min: 0,
					max: 127
				},
				{
					name: "variation",
					label: "Random variation ±",
					values: numbers(0, 30),
					min: 0,
					max: 30
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const low = Math.min(Number(this.options.minimum), Number(this.options.maximum))
		const high = Math.max(Number(this.options.minimum), Number(this.options.maximum))
		const shaped =
			this.options.fixed ||
			low + (high - low) * (voice.input.velocity / 127) ** Number(this.options.curve)
		return [
			this.start(
				voice,
				voice.input.number,
				this.now,
				clamp(
					Number(shaped) + (Math.random() * 2 - 1) * Number(this.options.variation),
					low,
					high
				)
			)
		]
	}
}