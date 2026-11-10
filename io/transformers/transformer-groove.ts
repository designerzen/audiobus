import type { IAudioCommand } from "../../audio-command-interface.ts"
import {
	PerformanceTransformer,
	beatSeconds,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"

export const ID_GROOVE = "Groove"

/** Nonnegative, periodic time warps let live input acquire groove without lookahead. */
export class TransformerGroove extends PerformanceTransformer {
	type = ID_GROOVE
	category = TRANSFORMER_CATEGORY_TIMING
	private delays = new Map<Voice, number>()
	get name() {
		return "Groove"
	}
	get description() {
		return "Reshape input timing with swing, triplet shuffle and curved groove functions."
	}
	get instructions() {
		return "Choose a timing function, subdivision and amount. Swing and shuffle delay offbeats; sine and triangle add a smooth pulse. Note lengths are preserved."
	}
	constructor(config: Settings = {}) {
		super(
			{ function: "swing", subdivision: "1/8", amount: 50 },
			[
				{
					name: "function",
					label: "Timing function",
					help: "At 100% amount, swing gives a 3:1 feel and shuffle gives triplet 2:1 timing.",
					values: ["swing", "shuffle", "sine", "triangle"]
				},
				{
					name: "subdivision",
					label: "Subdivision",
					values: ["1/4", "1/8", "1/16", "1/32"]
				},
				{
					name: "amount",
					label: "Amount (%)",
					help: "0% keeps straight timing; 100% applies the full groove.",
					min: 0,
					max: 100
				}
			],
			config
		)
	}
	private delay(): number {
		const step =
			(beatSeconds(this.timer) * 4) / Number(String(this.options.subdivision).slice(2))
		const origin = this.timer && this.timer.startTime >= 0 ? this.timer.startTime : 0
		const phase = ((((this.now - origin) / (2 * step)) % 1) + 1) % 1
		const triangle = 1 - Math.abs(2 * phase - 1)
		let curve: number
		switch (this.options.function) {
			case "sine":
				curve = Math.sin(Math.PI * phase) ** 2 / Math.PI
				break
			case "triangle":
				// One pulse per subdivision, with a peak between grid points.
				curve = (1 - Math.abs(2 * ((phase * 2) % 1) - 1)) / 4
				break
			case "shuffle":
				curve = triangle / 3
				break
			default:
				curve = triangle / 2
		}
		return (step * curve * Number(this.options.amount)) / 100
	}
	protected noteOn(voice: Voice): IAudioCommand[] {
		const delay = this.delay()
		this.delays.set(voice, delay)
		this.schedule(this.now + delay, () => [this.start(voice)], voice, routeKey(voice.input))
		return []
	}
	protected noteOff(voice: Voice, _command: IAudioCommand): IAudioCommand[] {
		// Keep short taps: their onset and release both move by the same delay.
		const delay = this.delays.get(voice) ?? 0
		this.schedule(
			this.now + delay,
			() => {
				this.delays.delete(voice)
				return this.release(voice)
			},
			voice,
			routeKey(voice.input)
		)
		return []
	}
	protected clearState(): void {
		this.delays?.clear()
	}
	protected clearRoute(route: string): IAudioCommand[] {
		for (const voice of this.delays.keys()) {
			if (routeKey(voice.input) === route) {
				this.delays.delete(voice)
			}
		}
		return []
	}
}