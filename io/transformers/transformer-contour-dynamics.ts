import {
	PerformanceTransformer,
	beatSeconds,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer"

export const ID_CONTOUR_DYNAMICS = "Contour-Dynamics"

export class TransformerContourDynamics extends PerformanceTransformer {
	type = ID_CONTOUR_DYNAMICS
	category = "Variation"
	private previous = new Map<string, { pitch: number; at: number }>()
	get name() {
		return "Contour Dynamics"
	}
	get description() {
		return "Shape melodic expression from rising, falling and repeated pitches, with extra emphasis on leaps."
	}
	constructor(config: Settings = {}) {
		super(
			{ rising: 120, falling: 80, repeated: 95, leap: 10, gap: 4 },
			[
				{
					name: "rising",
					label: "Rising velocity (%)",
					values: [50, 75, 100, 110, 120, 140, 160],
					min: 1,
					max: 200
				},
				{
					name: "falling",
					label: "Falling velocity (%)",
					values: [50, 75, 80, 100, 120, 150],
					min: 1,
					max: 200
				},
				{
					name: "repeated",
					label: "Repeated pitch velocity (%)",
					values: [50, 75, 95, 100, 125],
					min: 1,
					max: 200
				},
				{
					name: "leap",
					label: "Extra velocity per octave (%)",
					values: [0, 5, 10, 20, 30, 50],
					min: 0,
					max: 50
				},
				{
					name: "gap",
					label: "Forget contour after silence (beats)",
					values: [1, 2, 4, 8, 16],
					min: 0.25,
					max: 32
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const key = routeKey(voice.input),
			previous = this.previous.get(key)
		let gain = 100
		if (
			previous &&
			this.now - previous.at <= beatSeconds(this.timer) * Number(this.options.gap)
		) {
			const interval = voice.input.number - previous.pitch
			gain = Number(
				interval > 0
					? this.options.rising
					: interval < 0
						? this.options.falling
						: this.options.repeated
			)
			gain += (Math.abs(interval) / 12) * Number(this.options.leap)
		}
		this.previous.set(key, { pitch: voice.input.number, at: this.now })
		return [
			this.start(voice, voice.input.number, this.now, (voice.input.velocity * gain) / 100)
		]
	}
	protected clearState() {
		this.previous?.clear()
	}
	protected clearRoute(route: string) {
		this.previous.delete(route)
		return []
	}
}