import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer"

export const ID_RHYTHM_WEAVE = "Rhythm-Weave"
interface Weave {
	step: number
	at: number
	pass: boolean
	accent: boolean
}

export class TransformerRhythmWeave extends PerformanceTransformer {
	type = ID_RHYTHM_WEAVE
	category = "Pattern"
	private patterns = new Map<string, Weave>()
	get name() {
		return "Rhythm Weave"
	}
	get description() {
		return "Interlock two gesture-counting cycles, keeping their union, intersections or alternating strands."
	}
	get instructions() {
		return "Keep playing a pulse. Two independent counters decide which gestures sound; a meeting of both cycles receives an accent. Notes within the chord window share one decision."
	}
	constructor(config: Settings = {}) {
		super(
			{
				cycleA: 3,
				cycleB: 5,
				mode: "union",
				offsetA: 0,
				offsetB: 0,
				accent: 120,
				level: 80,
				collect: 25
			},
			[
				{
					name: "cycleA",
					label: "Strand A: every N gestures",
					values: numbers(1, 16),
					min: 1,
					max: 16
				},
				{
					name: "cycleB",
					label: "Strand B: every N gestures",
					values: numbers(1, 16),
					min: 1,
					max: 16
				},
				{
					name: "mode",
					label: "Weave rule",
					values: ["union", "intersection", "exclusive"],
					help: "Union plays either strand; intersection plays only meetings; exclusive plays a strand only when the other is silent."
				},
				{
					name: "offsetA",
					label: "Strand A offset",
					values: numbers(0, 15),
					min: 0,
					max: 15
				},
				{
					name: "offsetB",
					label: "Strand B offset",
					values: numbers(0, 15),
					min: 0,
					max: 15
				},
				{
					name: "accent",
					label: "Meeting velocity (%)",
					values: [75, 100, 120, 150],
					min: 1,
					max: 200
				},
				{
					name: "level",
					label: "Single-strand velocity (%)",
					values: [50, 70, 80, 100],
					min: 1,
					max: 100
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
		const key = routeKey(voice.input)
		let state = this.patterns.get(key)
		if (!state || this.now - state.at > Number(this.options.collect) / 1000) {
			const cycleA = Math.round(Number(this.options.cycleA)),
				cycleB = Math.round(Number(this.options.cycleB))
			const step = state ? (state.step + 1) % (cycleA * cycleB) : 0
			const a = step % cycleA === Math.round(Number(this.options.offsetA)) % cycleA
			const b = step % cycleB === Math.round(Number(this.options.offsetB)) % cycleB
			const pass =
				this.options.mode === "intersection"
					? a && b
					: this.options.mode === "exclusive"
						? a !== b
						: a || b
			state = { step, at: this.now, pass, accent: a && b }
			this.patterns.set(key, state)
		}
		return state.pass
			? [
					this.start(
						voice,
						voice.input.number,
						this.now,
						(voice.input.velocity *
							Number(state.accent ? this.options.accent : this.options.level)) /
							100
					)
				]
			: []
	}
	protected clearState() {
		this.patterns?.clear()
	}
	protected clearRoute(route: string) {
		this.patterns.delete(route)
		return []
	}
}