import {
	PerformanceTransformer,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"

export const ID_PITCH_MIRROR = "Pitch-Mirror"
export class TransformerPitchMirror extends PerformanceTransformer {
	type = ID_PITCH_MIRROR
	category = "Pitch"
	get name() {
		return "Pitch Mirror"
	}
	get description() {
		return "Invert melodic intervals around a centre note, preserving the original note releases."
	}
	constructor(config: Settings = {}) {
		super(
			{ centre: 60, outside: "block" },
			[
				{
					name: "centre",
					label: "Mirror centre (MIDI note)",
					values: numbers(0, 127),
					min: 0,
					max: 127,
					help: "The centre stays unchanged. Notes above it move the same distance below it."
				},
				{ name: "outside", label: "Outside MIDI range", values: ["block", "octave-fold"] }
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		let pitch = 2 * Math.round(Number(this.options.centre)) - voice.input.number
		if (this.options.outside === "octave-fold") {
			while (pitch < 0) {
				pitch += 12
			}
			while (pitch > 127) {
				pitch -= 12
			}
		}
		return pitch >= 0 && pitch <= 127 ? [this.start(voice, pitch)] : []
	}
}