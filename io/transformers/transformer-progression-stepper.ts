import { TonalProgressionTransformer } from "./tonal-progression-transformer"
import { type ProgressionRoute } from "./progression-performer"
import { routeKey, numbers, type Settings, type Voice } from "./performance-transformer"
import { parseTheoryProgression } from "../../tuning/classical-progressions"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import { CONTROL_CHANGE } from "../../commands/commands"

export const ID_PROGRESSION_STEPPER = "Progression-Stepper"
export class TransformerProgressionStepper extends TonalProgressionTransformer {
	type = ID_PROGRESSION_STEPPER
	category = "Harmony"
	private positions = new Map<string, number>()
	private pedals = new Map<string, boolean>()
	get name() {
		return "Progression Stepper"
	}
	get description() {
		return "Play Roman-numeral or named-chord progressions by gesture, beats or pedal taps."
	}
	get fields() {
		return super.fields.filter(
			(field) =>
				!["single", "arrival", "targetRoot", "step", "finalBeats"].includes(field.name)
		)
	}
	get instructions() {
		return "Enter Roman numerals or chord names, with optional beat lengths: I:4 vi:4 ii6:2 V7:2, or C:4 Am:4 Dm/F:2 G7:2. Gesture advances once per collected chord; pedal mode advances on rising CC values. Beat mode plays a cycle and can repeat while keys stay held."
	}
	constructor(config: Settings = {}) {
		super(
			{
				progression: "I:4 vi:4 IV:4 V7:4",
				advance: "gesture",
				loop: 0,
				pedal: 64,
				pedalThru: 0,
				single: "chord-root"
			},
			[
				{
					name: "progression",
					label: "Chord progression",
					help: "Supports major/minor Roman numerals, b/# degrees, inversions (6, 64, 65, 43, 42), seventh chords, applied chords (V7/ii), It+6, Fr+6, Ger+6 and named slash chords. Durations use :beats."
				},
				{ name: "advance", label: "Advance by", values: ["gesture", "beats", "pedal"] },
				{
					name: "loop",
					label: "Repeat beat cycles while keys are held",
					values: [0, 1],
					min: 0,
					max: 1
				},
				{
					name: "pedal",
					label: "Advance pedal CC",
					values: numbers(0, 119),
					min: 0,
					max: 119
				},
				{
					name: "pedalThru",
					label: "Also pass advance pedal to instrument",
					values: [0, 1],
					min: 0,
					max: 1
				}
			],
			config
		)
	}
	override setConfig(key: string, value: unknown) {
		if (key === "progression") parseTheoryProgression(String(value))
		super.setConfig(key, value)
	}
	private play(voices: Voice[], route: ProgressionRoute, position: number) {
		const progression = parseTheoryProgression(
			String(this.options.progression),
			this.tonic(),
			this.mode()
		)
		const chosen =
			this.options.advance === "beats"
				? [
						...progression.slice(position % progression.length),
						...progression.slice(0, position % progression.length)
					]
				: [progression[position % progression.length]]
		const steps = this.voiced(chosen, route.last)
		return this.perform(
			voices,
			route,
			steps,
			this.options.advance === "beats" && Boolean(this.options.loop)
		)
	}
	protected gesture(voices: Voice[], route: ProgressionRoute) {
		const key = routeKey(voices[0].input),
			position = this.positions.get(key) ?? 0
		if (this.options.advance === "gesture") this.positions.set(key, position + 1)
		return this.play(voices, route, position)
	}
	protected other(command: IAudioCommand): IAudioCommand[] {
		if (
			this.options.advance !== "pedal" ||
			command.type !== CONTROL_CHANGE ||
			command.number !== Math.round(Number(this.options.pedal))
		)
			return [command]
		const key = routeKey(command),
			down = command.value >= 64,
			wasDown = this.pedals.get(key) ?? false
		this.pedals.set(key, down)
		const result: IAudioCommand[] = this.options.pedalThru ? [command] : []
		const route = this.routes.get(key)
		if (down && !wasDown && route?.keys.length) {
			const position = (this.positions.get(key) ?? 0) + 1
			this.positions.set(key, position)
			result.push(...this.cancelPhrase(route), ...this.play(route.keys, route, position))
		}
		return result
	}
	protected clearState() {
		super.clearState()
		this.positions?.clear()
		this.pedals?.clear()
	}
	protected clearRoute(key: string) {
		this.positions.delete(key)
		this.pedals.delete(key)
		return super.clearRoute(key)
	}
}