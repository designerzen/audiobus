import { TonalProgressionTransformer } from "./tonal-progression-transformer"
import type { ProgressionRoute } from "./progression-performer"
import type { Settings, Voice } from "./performance-transformer"

export const ID_KEY_TRAVELLER = "Key-Traveller"
export class TransformerKeyTraveller extends TonalProgressionTransformer {
	type = ID_KEY_TRAVELLER
	category = "Harmony"
	get name() {
		return "Key Traveller"
	}
	get description() {
		return "Mediate changes of tonal centre through shared pivots, common tones or diminished-seventh reinterpretation."
	}
	constructor(config: Settings = {}) {
		super(
			{ method: "pivot", single: "chord-root" },
			[
				{
					name: "method",
					label: "Modulation path",
					values: [
						{ name: "Shared diatonic pivot", value: "pivot" },
						{ name: "Common-tone modulation", value: "common-tone-modulation" },
						{ name: "Enharmonic diminished seventh", value: "enharmonic-diminished" },
						{ name: "Applied-dominant chain", value: "dominant-chain" }
					]
				}
			],
			config
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		return this.bridge(voices, route, String(this.options.method))
	}
}