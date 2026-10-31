import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import { classicalVoicing } from "../../tuning/classical-voice-leading"
import { DEFAULT_HARMONY, type HarmonicState } from "../harmony"

export const ID_VOICE_LEADER = "Voice-Leader"
/** Score inversions in voice order, then map the chosen octaves back to each input pitch. */
export function leadVoices(
	notes: number[],
	previous: number[],
	lower: number,
	upper: number,
	leap: number,
	common: boolean
): number[] {
	const sorted = [...notes].sort((a, b) => a - b)
	const solve = (inversion: number[], limitLeap: boolean) => {
		let paths = new Map<number, { cost: number; notes: number[] }>([
			[-1, { cost: 0, notes: [] }]
		])
		for (const [index, note] of inversion.entries()) {
			const next = new Map<number, { cost: number; notes: number[] }>()
			const target = previous[index] ?? note
			for (let pitch = lower; pitch <= upper; pitch++) {
				if (
					(pitch - note) % 12 !== 0 ||
					(limitLeap && previous[index] !== undefined && Math.abs(pitch - target) > leap)
				) {
					continue
				}
				for (const [last, path] of paths) {
					if (pitch <= last) {
						continue
					}
					const cost =
						path.cost +
						Math.abs(pitch - target) -
						(common && previous.includes(pitch) ? 6 : 0)
					if (!next.has(pitch) || next.get(pitch)!.cost > cost) {
						next.set(pitch, { cost, notes: [...path.notes, pitch] })
					}
				}
			}
			paths = next
		}
		return [...paths.values()].sort((a, b) => a.cost - b.cost)[0]
	}
	const inversions = sorted.map((_, i) => [...sorted.slice(i), ...sorted.slice(0, i)])
	for (const limitLeap of [true, false]) {
		const best = inversions
			.map((inversion) => solve(inversion, limitLeap))
			.filter((path) => path !== undefined)
			.sort((a, b) => a.cost - b.cost)[0]
		if (!best) {
			continue
		}
		const remaining = [...best.notes]
		return sorted.map((note) => {
			const index = remaining.findIndex((pitch) => (pitch - note) % 12 === 0)
			return remaining.splice(index, 1)[0]
		})
	}
	return sorted
}
export class TransformerVoiceLeader extends PerformanceTransformer {
	type = ID_VOICE_LEADER
	category = "Harmony"
	private chords = new Map<string, Voice[]>()
	private previous = new Map<string, number[]>()
	private harmony = { ...DEFAULT_HARMONY }
	setHarmony(state: HarmonicState): void { this.harmony = { ...state } }
	get name() {
		return "Voice Leader"
	}
	get description() {
		return "Choose octave placements across successive chords to keep voices moving smoothly."
	}
	constructor(config: Settings = {}) {
		super(
			{ lower: 48, upper: 84, leap: 12, common: 1, collect: 30, style: "smooth", parallels: 1, leadingTone: 1 },
			[
				{ name: "style", label: "Voice-leading style", values: ["smooth", "classical"], help: "Classical produces four SATB voices, preserves chord tones, enforces ranges and spacing, and stays silent when no legal voicing exists." },
				{ name: "parallels", label: "Forbid parallel fifths and octaves", values: [0, 1], min: 0, max: 1 },
				{ name: "leadingTone", label: "Resolve leading tones up to the shared tonic", values: [0, 1], min: 0, max: 1 },
				{ name: "lower", label: "Lowest note", values: numbers(0, 127), min: 0, max: 127 },
				{ name: "upper", label: "Highest note", values: numbers(0, 127), min: 0, max: 127 },
				{
					name: "leap",
					label: "Preferred maximum leap",
					values: [2, 3, 5, 7, 12, 24],
					min: 1,
					max: 48,
					help: "Semitones. Relaxed when no valid chord fits this limit."
				},
				{ name: "common", label: "Prefer common tones", values: [0, 1], min: 0, max: 1 },
				{
					name: "collect",
					label: "Chord window (ms)",
					values: [0, 10, 20, 30, 50, 100],
					min: 0,
					max: 200
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const key = routeKey(voice.input)
		let chord = this.chords.get(key)
		if (!chord) {
			chord = []
			this.chords.set(key, chord)
			this.schedule(
				this.now + Number(this.options.collect) / 1000,
				() => {
					const voices = (this.chords.get(key) ?? [])
						.filter((voice) => !voice.released)
						.sort((a, b) => a.input.number - b.input.number)
					this.chords.delete(key)
					if (!voices.length) {
						return []
					}
					const low = Math.min(Number(this.options.lower), Number(this.options.upper)),
						high = Math.max(Number(this.options.lower), Number(this.options.upper))
					const classical = this.options.style === "classical"
					const pitches = classical ? classicalVoicing(voices.map((voice) => voice.input.number), this.previous.get(key) ?? [], {
						lower: low, upper: high, leap: Number(this.options.leap), common: Boolean(this.options.common),
						root: this.harmony.root, leadingTone: Boolean(this.options.leadingTone), parallels: Boolean(this.options.parallels)
					}) : leadVoices(
						voices.map((voice) => voice.input.number),
						this.previous.get(key) ?? [],
						low,
						high,
						Number(this.options.leap),
						Boolean(this.options.common)
					)
					if (!pitches.length) return []
					this.previous.set(
						key,
						[...pitches].sort((a, b) => a - b)
					)
					return classical ? pitches.map((pitch) => this.start(voices.find((voice) => (pitch - voice.input.number) % 12 === 0)!, pitch))
						: voices.map((voice, i) => this.start(voice, pitches[i]))
				},
				undefined,
				key
			)
		}
		chord.push(voice)
		return []
	}
	protected clearState() {
		this.chords?.clear()
		this.previous?.clear()
	}
	protected clearRoute(route: string) {
		this.chords.delete(route)
		this.previous.delete(route)
		return []
	}
}
