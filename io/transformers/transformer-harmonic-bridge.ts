import { TonalProgressionTransformer, conceptChoices } from "./tonal-progression-transformer"
import type { ProgressionRoute } from "./progression-performer"
import type { Settings, Voice } from "./performance-transformer"

export const ID_HARMONIC_BRIDGE = "Harmonic-Bridge"
export class TransformerHarmonicBridge extends TonalProgressionTransformer {
	type = ID_HARMONIC_BRIDGE
	category = "Harmony"
	get name() {
		return "Harmonic Bridge"
	}
	get description() {
		return "Connect successive notes or chords through classical preparations, sequences and chromatic harmony."
	}
	get instructions() {
		return "Play a starting chord, then a destination. The destination is delayed while a progression prepares it. A new gesture interrupts the old phrase and starts from its last sounding harmony. Single notes can remain melodic or act as chord roots."
	}
	constructor(config: Settings = {}) {
		super(
			{ concept: "predominant" },
			[{ name: "concept", label: "Connection concept", values: conceptChoices() }],
			config
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		return this.bridge(voices, route, String(this.options.concept))
	}
}