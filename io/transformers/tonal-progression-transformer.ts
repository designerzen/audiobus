import {
	PROGRESSION_CONTROLS,
	PROGRESSION_DEFAULTS,
	ProgressionPerformer,
	type ProgressionRoute
} from "./progression-performer"
import { type Settings, type Control, type Voice } from "./performance-transformer"
import {
	CLASSICAL_CONCEPTS,
	classicalBridgeRecipe,
	inferChord,
	makeTheoryChord,
	type TonalMode,
	type TheoryChord
} from "../../tuning/classical-progressions"
import {
	voiceTheoryPath,
	type ProgressionVoicing,
	type SoundingStep
} from "../../tuning/progression-voicing"
import { melodicMediation } from "../../tuning/melodic-mediation"
import { NOTE_NAMES } from "../harmony"
import { mod12 } from "../../tuning/pitch-class-set"

export const TONAL_DEFAULTS: Settings = {
	...PROGRESSION_DEFAULTS,
	source: "local",
	key: 0,
	mode: "major",
	single: "melody",
	arrival: "played",
	targetRoot: -1
}
export const TONAL_CONTROLS: Control[] = [
	{ name: "source", label: "Key source", values: ["local", "shared"] },
	{
		name: "key",
		label: "Local key",
		values: NOTE_NAMES.map((name, value) => ({ name, value })),
		min: 0,
		max: 11
	},
	{ name: "mode", label: "Mode", values: ["major", "minor"] },
	{
		name: "single",
		label: "Single notes are",
		values: ["melody", "chord-root"],
		help: "Melody connects exact notes. Chord-root expands a single note into a major/minor triad before planning harmony."
	},
	{
		name: "arrival",
		label: "Destination voicing",
		values: ["played", "voice-led"],
		help: "Played retains your exact notes, including dissonances. Voice-led can change octaves and doubling while preserving chord pitch classes and bass."
	},
	{
		name: "targetRoot",
		label: "Destination root",
		values: [
			{ name: "Infer from played chord", value: -1 },
			...NOTE_NAMES.map((name, value) => ({ name, value }))
		],
		min: -1,
		max: 11
	},
	...PROGRESSION_CONTROLS
]
export const conceptChoices = (family?: string) =>
	CLASSICAL_CONCEPTS.filter((concept) => !family || concept.family === family).map((concept) => ({
		name: concept.name,
		value: concept.id
	}))

export abstract class TonalProgressionTransformer extends ProgressionPerformer {
	constructor(defaults: Settings, controls: Control[], config: Settings = {}) {
		super({ ...TONAL_DEFAULTS, ...defaults }, [...controls, ...TONAL_CONTROLS], config)
	}
	protected tonic() {
		return this.options.source === "shared"
			? this.harmony.root
			: Math.round(Number(this.options.key))
	}
	protected mode(): TonalMode {
		return this.options.mode === "minor" ? "minor" : "major"
	}
	protected target(voices: Voice[]): number[] {
		const notes = [...new Set(voices.map((voice) => voice.input.number))].sort((a, b) => a - b)
		if (notes.length === 1 && this.options.single === "chord-root")
			return [0, this.mode() === "minor" ? 3 : 4, 7]
				.map((interval) => notes[0] + interval)
				.filter((pitch) => pitch <= 127)
		return notes
	}
	protected voiced(chords: TheoryChord[], previous: number[]): SoundingStep[] {
		return voiceTheoryPath(
			chords,
			previous,
			Number(this.options.lower),
			Number(this.options.upper),
			String(this.options.voicing) as ProgressionVoicing
		)
	}
	protected destination(notes: number[]): TheoryChord {
		const inferred = inferChord(
			notes,
			Number(this.options.targetRoot) >= 0 ? Number(this.options.targetRoot) : undefined
		)
		return makeTheoryChord(
			inferred.root,
			notes.map((note) => mod12(note - inferred.root)),
			"Destination",
			Number(this.options.finalBeats),
			notes[0]
		)
	}
	protected bridge(
		voices: Voice[],
		route: ProgressionRoute,
		concept: string,
		prepareFirst = false
	) {
		const target = this.target(voices)
		if (!route.last.length && !prepareFirst)
			return this.perform(voices, route, [
				{
					notes: target,
					label: "Starting harmony",
					root: this.destination(target).root,
					beats: Number(this.options.finalBeats)
				}
			])
		if (target.length === 1 && this.options.single === "melody") {
			const path = melodicMediation(
				route.last,
				target,
				"diatonic",
				this.tonic(),
				this.mode(),
				Number(this.options.step),
				Number(this.options.finalBeats)
			)
			this.status = path.message
			return this.perform(voices, route, path.steps)
		}
		const recipe = classicalBridgeRecipe(
			concept,
			route.last.length ? route.last : target,
			target,
			this.mode(),
			Number(this.options.targetRoot)
		)
		const chords = recipe.chords.map((chord) => ({
			...chord,
			beats: Number(this.options.step)
		}))
		const end = this.destination(target)
		if (this.options.arrival === "voice-led") chords.push(end)
		const steps = this.voiced(chords, route.last)
		if (chords.length && !steps.length) return this.perform(voices, route, [])
		if (this.options.arrival === "played")
			steps.push({
				notes: target,
				label: `${recipe.message}: destination`,
				beats: Number(this.options.finalBeats),
				root: end.root
			})
		this.status = recipe.message
		return this.perform(voices, route, steps)
	}
}