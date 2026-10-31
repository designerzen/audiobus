import { TonalProgressionTransformer } from "./tonal-progression-transformer"
import type { ProgressionRoute } from "./progression-performer"
import type { Settings, Voice } from "./performance-transformer"

export const ID_TENSION_ARC = "Tension-Arc"
export class TransformerTensionArc extends TonalProgressionTransformer {
	type = ID_TENSION_ARC
	category = "Harmony"
	get name() {
		return "Tension Arc"
	}
	get description() {
		return "Shape successive destinations into an arc of mild, predominant, chromatic and resolving preparations."
	}
	constructor(config: Settings = {}) {
		super(
			{ shape: "arch", peak: "neapolitan", single: "chord-root" },
			[
				{ name: "shape", label: "Phrase arc", values: ["arch", "rising", "falling"] },
				{
					name: "peak",
					label: "Peak preparation",
					values: [
						"neapolitan",
						"german-sixth",
						"dominant-chain",
						"applied-leading-tone"
					],
					help: "Tension here means a harmonic recipe, not a measurement of how consonant a sound is."
				}
			],
			config
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		const peak = String(this.options.peak)
		const arc =
			this.options.shape === "rising"
				? ["plagal", "predominant", "double-dominant", peak]
				: this.options.shape === "falling"
					? [peak, "double-dominant", "predominant", "authentic"]
					: ["plagal", "predominant", peak, "authentic"]
		return this.bridge(voices, route, arc[route.turn % arc.length], true)
	}
}