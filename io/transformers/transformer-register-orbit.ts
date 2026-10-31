import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer"

export const ID_REGISTER_ORBIT = "Register-Orbit"
interface Orbit {
	step: number
	at: number
	target: number
}

export class TransformerRegisterOrbit extends PerformanceTransformer {
	type = ID_REGISTER_ORBIT
	category = "Pitch"
	private orbits = new Map<string, Orbit>()
	get name() {
		return "Register Orbit"
	}
	get description() {
		return "Move a register target around a bounded range, placing each played pitch class in its nearest octave."
	}
	get instructions() {
		return "Repeated gestures move the target register. Pitch classes stay the same, while their octaves follow the orbit. Chord notes arriving together share a target."
	}
	constructor(config: Settings = {}) {
		super(
			{ lower: 48, upper: 84, stride: 7, collect: 25 },
			[
				{
					name: "lower",
					label: "Lowest output note",
					values: numbers(0, 127),
					min: 0,
					max: 127
				},
				{
					name: "upper",
					label: "Highest output note",
					values: numbers(0, 127),
					min: 0,
					max: 127
				},
				{
					name: "stride",
					label: "Target movement per gesture (semitones)",
					values: [-24, -12, -7, -5, 0, 5, 7, 12, 24],
					min: -24,
					max: 24
				},
				{
					name: "collect",
					label: "Chord window (ms)",
					values: [0, 10, 25, 50, 100],
					min: 0,
					max: 200
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const lower = Math.round(Math.min(Number(this.options.lower), Number(this.options.upper)))
		const upper = Math.round(Math.max(Number(this.options.lower), Number(this.options.upper)))
		const span = upper - lower + 1,
			key = routeKey(voice.input)
		let state = this.orbits.get(key)
		if (!state || this.now - state.at > Number(this.options.collect) / 1000) {
			const step = state ? (state.step + 1) % span : 0
			const offset = step * Math.round(Number(this.options.stride))
			state = { step, at: this.now, target: lower + (((offset % span) + span) % span) }
			this.orbits.set(key, state)
		}
		const target = Math.max(lower, Math.min(upper, state.target))
		let chosen: number | undefined
		for (let pitch = lower; pitch <= upper; pitch++) {
			if ((pitch - voice.input.number) % 12 !== 0) continue
			if (chosen === undefined || Math.abs(pitch - target) < Math.abs(chosen - target))
				chosen = pitch
		}
		return chosen === undefined ? [] : [this.start(voice, chosen)]
	}
	protected clearState() {
		this.orbits?.clear()
	}
	protected clearRoute(route: string) {
		this.orbits.delete(route)
		return []
	}
}