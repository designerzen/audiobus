import { TonalProgressionTransformer } from "./tonal-progression-transformer"
import type { ProgressionRoute } from "./progression-performer"
import type { Settings, Voice } from "./performance-transformer"
import { melodicMediation, MELODIC_APPROACHES } from "../../tuning/melodic-mediation"

export const ID_MELODIC_MEDIATOR = "Melodic-Mediator"
export class TransformerMelodicMediator extends TonalProgressionTransformer {
	type = ID_MELODIC_MEDIATOR
	category = "Harmony"
	get name() {
		return "Melodic Mediator"
	}
	get description() {
		return "Join notes or chord voices with passing tones, neighbour approaches, prepared suspensions or anticipations."
	}
	get fields() {
		return super.fields.filter(
			(field) => !["voicing", "lower", "upper", "arrival", "targetRoot"].includes(field.name)
		)
	}
	constructor(config: Settings = {}) {
		super(
			{ approach: "diatonic", maximum: 16 },
			[
				{
					name: "approach",
					label: "Voice connection",
					values: MELODIC_APPROACHES.map((approach) => ({
						name: approach.name,
						value: approach.id
					}))
				},
				{
					name: "maximum",
					label: "Maximum intermediate steps",
					values: [4, 8, 12, 16, 24, 32],
					min: 1,
					max: 32
				}
			],
			config
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		const path = melodicMediation(
			route.last,
			this.target(voices),
			String(this.options.approach),
			this.tonic(),
			this.mode(),
			Number(this.options.step),
			Number(this.options.finalBeats),
			Math.round(Number(this.options.maximum))
		)
		this.status = path.message
		return this.perform(voices, route, path.steps)
	}
}