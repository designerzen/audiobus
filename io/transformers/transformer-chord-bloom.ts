import {
	PerformanceTransformer,
	beatSeconds,
	type Settings,
	type Voice
} from "./performance-transformer"
import { parseIntervals } from "./transformer-interval-stack"
import type { IAudioCommand } from "../../audio-command-interface"

export const ID_CHORD_BLOOM = "Chord-Bloom"

export class TransformerChordBloom extends PerformanceTransformer {
	type = ID_CHORD_BLOOM
	category = "Harmony"
	private intervals: number[] = []
	get name() {
		return "Chord Bloom"
	}
	get description() {
		return "Let held notes grow into sustained harmony, adding one interval at a time."
	}
	get instructions() {
		return "Hold a note to let its harmony unfold. Releasing the key ends every voice and cancels any voices that have not yet arrived."
	}
	constructor(config: Settings = {}) {
		super(
			{ intervals: "0, 7, 12, 19", step: 0.5, falloff: 15 },
			[
				{
					name: "intervals",
					label: "Bloom intervals",
					help: "Up to eight semitone offsets in arrival order, from -48 to +48. Include 0 to begin with the original note."
				},
				{
					name: "step",
					label: "Time between voices (beats)",
					values: [0.125, 0.25, 0.5, 1, 2, 4],
					min: 0.125,
					max: 4
				},
				{
					name: "falloff",
					label: "Velocity falloff per voice (%)",
					values: [0, 5, 10, 15, 20, 30],
					min: 0,
					max: 50
				}
			],
			config
		)
		this.intervals = parseIntervals(String(this.options.intervals))
	}
	override setConfig(key: string, value: unknown) {
		const intervals = key === "intervals" ? parseIntervals(String(value)) : undefined
		super.setConfig(key, value)
		if (intervals) this.intervals = intervals
	}
	protected noteOn(voice: Voice): IAudioCommand[] {
		const result: IAudioCommand[] = []
		const step = beatSeconds(this.timer) * Number(this.options.step)
		const falloff = Number(this.options.falloff) / 100
		for (const [index, interval] of this.intervals.entries()) {
			const pitch = voice.input.number + interval
			if (pitch < 0 || pitch > 127) continue
			const velocity = voice.input.velocity * (1 - falloff) ** index
			if (index === 0) result.push(this.start(voice, pitch, this.now, velocity))
			else
				this.schedule(
					this.now + index * step,
					() => [this.start(voice, pitch, this.now, velocity)],
					voice
				)
		}
		return result
	}
}