import {
	PerformanceTransformer,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"

export const ID_PROBABILITY_GATE = "Probability-Gate"
export class TransformerProbabilityGate extends PerformanceTransformer {
	type = ID_PROBABILITY_GATE
	category = "Variation"
	private state = 0
	get name() {
		return "Probability Gate"
	}
	get description() {
		return "Thin notes with repeatable probability while preserving their matching releases."
	}
	constructor(config: Settings = {}) {
		super(
			{ chance: 75, seed: 1, lower: 0, upper: 127 },
			[
				{
					name: "chance",
					label: "Notes kept (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "seed",
					label: "Random seed",
					values: numbers(1, 32),
					min: 1,
					max: 2147483647
				},
				{
					name: "lower",
					label: "Lowest affected note",
					values: numbers(0, 127),
					min: 0,
					max: 127
				},
				{
					name: "upper",
					label: "Highest affected note",
					values: numbers(0, 127),
					min: 0,
					max: 127
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		if (
			voice.input.number < Number(this.options.lower) ||
			voice.input.number > Number(this.options.upper)
		) {
			return [this.start(voice)]
		}
		this.state =
			(Math.imul(this.state || Number(this.options.seed), 1664525) + 1013904223) >>> 0
		return this.state / 4294967296 < Number(this.options.chance) / 100
			? [this.start(voice)]
			: []
	}
	protected clearState() {
		this.state = 0
	}
}