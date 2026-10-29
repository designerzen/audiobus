import { PerformanceTransformer, type Settings, type Voice } from "./performance-transformer.ts"

export const ID_INTERVAL_STACK = "Interval-Stack"
export function parseIntervals(text: string): number[] {
	const tokens = text.trim().split(/[\s,;]+/)
	if (!text.trim() || tokens.length > 8 || tokens.some((token) => !/^[+-]?\d+$/.test(token))) {
		throw new Error("Enter up to eight semitone intervals, such as 0, 7, 12.")
	}
	const intervals = [...new Set(tokens.map(Number))]
	if (intervals.some((interval) => interval < -48 || interval > 48)) {
		throw new Error("Intervals must be between -48 and +48 semitones.")
	}
	return intervals
}
export class TransformerIntervalStack extends PerformanceTransformer {
	type = ID_INTERVAL_STACK
	category = "Harmony"
	private intervals: number[] = []
	get name() {
		return "Interval Stack"
	}
	get description() {
		return "Build custom parallel harmonies from up to eight fixed semitone intervals."
	}
	constructor(config: Settings = {}) {
		super(
			{ intervals: "0, 7, 12", falloff: 15 },
			[
				{
					name: "intervals",
					label: "Intervals (semitones)",
					help: "Comma-separated offsets, from -48 to +48. Include 0 to keep the original note. For example: 0, 4, 7, 11."
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
		if (intervals) {
			this.intervals = intervals
		}
	}
	protected noteOn(voice: Voice) {
		return this.intervals.flatMap((interval, index) => {
			const pitch = voice.input.number + interval
			return pitch < 0 || pitch > 127
				? []
				: [
						this.start(
							voice,
							pitch,
							this.now,
							voice.input.velocity * (1 - Number(this.options.falloff) / 100) ** index
						)
					]
		})
	}
}