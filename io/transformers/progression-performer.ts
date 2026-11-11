import {
	PerformanceTransformer,
	beatSeconds,
	copyCommand,
	numbers,
	routeKey,
	type Control,
	type Settings,
	type Voice
} from "./performance-transformer"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { SoundingStep } from "../../tuning/progression-voicing"
import { DEFAULT_HARMONY, type HarmonicState } from "../harmony"

export interface ProgressionRoute {
	last: number[]
	root?: number
	mode?: "major" | "minor"
	owner?: Voice
	keys: Voice[]
	turn: number
}
export const PROGRESSION_DEFAULTS: Settings = {
	collect: 30,
	step: 1,
	finalBeats: 2,
	hold: "phrase",
	lower: 40,
	upper: 84,
	voicing: "smooth",
	common: 1,
	level: 85
}
export const PROGRESSION_CONTROLS: Control[] = [
	{
		name: "collect",
		label: "Chord collection window (ms)",
		values: [0, 10, 20, 30, 50, 80],
		min: 0,
		max: 200
	},
	{
		name: "step",
		label: "Intermediate chord length (beats)",
		values: [0.125, 0.25, 0.5, 1, 2, 4],
		min: 0.125,
		max: 8
	},
	{
		name: "finalBeats",
		label: "Arrival length (beats)",
		values: [0.25, 0.5, 1, 2, 4, 8],
		min: 0.125,
		max: 32
	},
	{
		name: "hold",
		label: "Release behaviour",
		values: ["phrase", "keys"],
		help: "Phrase completes a bounded progression after key release. Keys cancels it when all keys of the new gesture are released."
	},
	{
		name: "voicing",
		label: "Intermediate voicing",
		values: ["smooth", "close", "classical"],
		help: "Classical uses four SATB ranges, spacing, overlap and parallel-fifth/octave constraints; an impossible path stays silent. Played destinations can retain your exact notes."
	},
	{ name: "lower", label: "Lowest generated note", values: numbers(24, 96), min: 0, max: 127 },
	{ name: "upper", label: "Highest generated note", values: numbers(36, 108), min: 0, max: 127 },
	{ name: "common", label: "Hold shared notes across changes", values: [0, 1], min: 0, max: 1 },
	{
		name: "level",
		label: "Intermediate velocity (%)",
		values: [40, 60, 75, 85, 100],
		min: 1,
		max: 100
	}
]

/** Per-input/channel gesture collection, cancellable phrases and balanced shared-tone playback. */
export abstract class ProgressionPerformer extends PerformanceTransformer {
	protected routes = new Map<string, ProgressionRoute>()
	private collecting = new Map<string, Voice[]>()
	protected harmony = { ...DEFAULT_HARMONY }
	status = "Play a note or chord to begin."
	setHarmony(state: HarmonicState) {
		this.harmony = { ...state }
	}
	protected noteOn(voice: Voice) {
		const key = routeKey(voice.input)
		let group = this.collecting.get(key)
		if (!group) {
			group = []
			this.collecting.set(key, group)
			this.schedule(
				this.now + Number(this.options.collect) / 1000,
				() => {
					const voices = this.collecting.get(key) ?? []
					this.collecting.delete(key)
					if (
						!voices.length ||
						(this.options.hold === "keys" && voices.every((voice) => voice.released))
					)
						return []
					const route = this.routes.get(key) ?? { last: [], keys: [], turn: 0 }
					this.routes.set(key, route)
					const interrupted = this.cancelPhrase(route)
					route.keys = voices
					const result = this.gesture(voices, route)
					route.turn++
					for (const input of voices) if (input.released) this.release(input)
					return [...interrupted, ...result]
				},
				undefined,
				key
			)
		}
		group.push(voice)
		return []
	}
	protected abstract gesture(voices: Voice[], route: ProgressionRoute): IAudioCommand[]
	protected cancelPhrase(route: ProgressionRoute): IAudioCommand[] {
		const result = route.owner ? this.release(route.owner) : []
		route.owner = undefined
		return result
	}
	protected perform(
		voices: Voice[],
		route: ProgressionRoute,
		steps: SoundingStep[],
		loop = false
	): IAudioCommand[] {
		if (
			!steps.length ||
			steps.some(
				(step) => !step.notes.length || !Number.isFinite(step.beats) || step.beats <= 0
			)
		) {
			this.status =
				"No voicing found for these rules and register. Widen the range or choose smooth voicing."
			return []
		}
		const owner: Voice = { input: copyCommand(voices[0].input), targets: [], released: false }
		this.voices.add(owner)
		route.owner = owner
		const playCycle = (): IAudioCommand[] => {
			if (route.owner !== owner || !this.options.enabled) return []
			const seconds = beatSeconds(this.timer)
			const start = this.now
			let offset = 0
			for (const [index, step] of steps.entries()) {
				this.schedule(
					start + offset,
					() => {
						if (route.owner !== owner) return []
						const result: IAudioCommand[] = []
						const retained = this.options.common
							? owner.targets.filter((target) => step.notes.includes(target.number))
							: []
						for (const target of [...owner.targets])
							if (!retained.includes(target)) result.push(this.end(owner, target))
						for (const pitch of step.notes)
							if (!retained.some((target) => target.number === pitch)) {
								result.push(
									this.start(
										owner,
										pitch,
										this.now,
										owner.input.velocity *
											(index === steps.length - 1
												? 1
												: Number(this.options.level) / 100)
									)
								)
							}
						route.last = [...step.notes]
						route.root = step.root
						this.status = step.label
						return result
					},
					owner
				)
				offset += step.beats * seconds
			}
			this.schedule(
				start + offset,
				() => {
					if (loop && route.keys.some((voice) => !voice.released)) return playCycle()
					if (route.owner === owner) route.owner = undefined
					return this.release(owner)
				},
				owner
			)
			return []
		}
		return playCycle()
	}
	protected noteOff(voice: Voice): IAudioCommand[] {
		const result = this.release(voice)
		const route = this.routes.get(routeKey(voice.input))
		if (
			route?.keys.includes(voice) &&
			route.keys.every((voice) => voice.released) &&
			this.options.hold === "keys"
		)
			result.push(...this.cancelPhrase(route))
		return result
	}
	protected clearState() {
		this.routes?.clear()
		this.collecting?.clear()
		this.status = "Play a note or chord to begin."
	}
	protected clearRoute(key: string) {
		this.routes.delete(key)
		this.collecting.delete(key)
		return []
	}
}