import { TonalProgressionTransformer, conceptChoices } from "./tonal-progression-transformer"
import type { ProgressionRoute } from "./progression-performer"
import type { Settings, Voice } from "./performance-transformer"

export const ID_CADENCE_WEAVER = "Cadence-Weaver"
export class TransformerCadenceWeaver extends TonalProgressionTransformer {
	type = ID_CADENCE_WEAVER
	category = "Harmony"
	get name() {
		return "Cadence Weaver"
	}
	get description() {
		return "Prepare a played destination with authentic, plagal, deceptive, half or Phrygian cadential harmony."
	}
	get instructions() {
		return "Play the chord you want to reach, or one root note. The chosen cadence prepares that arrival. Half cadences interpret a major destination as V; deceptive arrivals reinterpret the destination as vi or VI."
	}
	constructor(config: Settings = {}) {
		super(
			{ cadence: "cadential-six-four", single: "chord-root" },
			[{ name: "cadence", label: "Cadential approach", values: conceptChoices("cadence") }],
			config
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		return this.bridge(voices, route, String(this.options.cadence), true)
	}
}