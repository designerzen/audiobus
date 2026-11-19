import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"

/**
 * Bernoulli Gate, after Mutable Instruments Branches: each gesture tosses a
 * coin and is sent to outcome A or B. Toggle mode flips the previous outcome
 * with the given probability instead of choosing afresh.
 */
export const ID_BERNOULLI_GATE = "Bernoulli-Gate"
interface Toss {
	at: number
	b: boolean
}

export class TransformerBernoulliGate extends PerformanceTransformer {
	type = ID_BERNOULLI_GATE
	category = "Routing"
	private state = 0
	private tosses = new Map<string, Toss>()
	get name() {
		return "Bernoulli Gate"
	}
	get description() {
		return "Branches-style coin toss that sends each note or chord to channel A or B."
	}
	get instructions() {
		return "Route channels A and B to different outputs. Probability is the chance of B; in toggle mode it is the chance of switching sides. Notes within the chord window share one toss."
	}
	constructor(config: Settings = {}) {
		super(
			{
				probability: 50,
				mode: "toss",
				channelA: 0,
				channelB: 2,
				muteB: 0,
				collect: 25,
				seed: 1
			},
			[
				{
					name: "probability",
					label: "Probability (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "mode",
					label: "Mode",
					values: ["toss", "toggle"],
					help: "Toss chooses A or B for every gesture; toggle switches from the last outcome."
				},
				{
					name: "channelA",
					label: "Channel A",
					values: numbers(0, 16),
					min: 0,
					max: 16,
					help: "0 keeps the incoming channel."
				},
				{
					name: "channelB",
					label: "Channel B",
					values: numbers(0, 16),
					min: 0,
					max: 16,
					help: "0 keeps the incoming channel."
				},
				{
					name: "muteB",
					label: "Silence outcome B",
					values: [
						{ name: "Off", value: 0 },
						{ name: "On", value: 1 }
					]
				},
				{
					name: "collect",
					label: "Chord window (ms)",
					values: [0, 10, 25, 50, 100],
					min: 0,
					max: 200
				},
				{
					name: "seed",
					label: "Random seed",
					values: numbers(1, 32),
					min: 1,
					max: 2147483647
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const key = routeKey(voice.input)
		let toss = this.tosses.get(key)
		if (!toss || this.now - toss.at > Number(this.options.collect) / 1000) {
			this.state =
				(Math.imul(this.state || Number(this.options.seed), 1664525) + 1013904223) >>> 0
			const heads = this.state / 4294967296 < Number(this.options.probability) / 100
			toss = {
				at: this.now,
				b: this.options.mode === "toggle" ? heads !== (toss?.b ?? false) : heads
			}
			this.tosses.set(key, toss)
		}
		if (toss.b && Number(this.options.muteB)) {
			return []
		}
		const on = this.start(voice)
		const channel = Math.round(Number(toss.b ? this.options.channelB : this.options.channelA))
		if (channel > 0) {
			on.channel = channel
		}
		return [on]
	}
	protected clearState() {
		this.state = 0
		this.tosses?.clear()
	}
	protected clearRoute(route: string) {
		this.tosses.delete(route)
		return []
	}
}