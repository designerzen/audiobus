import {
	PerformanceTransformer,
	beatSeconds,
	clamp,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import {
	IONIAN_INTERVALS,
	AEOLIAN_INTERVALS,
	DORIAN_INTERVALS,
	MAJOR_PENTATONIC_INTERVALS,
	MINOR_PENTATONIC_INTERVALS
} from "../../tuning/intervals"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"

/**
 * Random Sampler, after Mutable Instruments Marbles (MIT, Emilie Gillet):
 * a T section decides when to play, an X section samples pitches from a
 * spread/bias distribution, and Déjà vu loops or mutates both random streams.
 */
export const ID_RANDOM_SAMPLER = "Random-Sampler"

export const RANDOM_SAMPLER_SCALES: Record<string, number[]> = {
	Major: IONIAN_INTERVALS,
	Minor: AEOLIAN_INTERVALS,
	Dorian: DORIAN_INTERVALS,
	"Major pentatonic": MAJOR_PENTATONIC_INTERVALS,
	"Minor pentatonic": MINOR_PENTATONIC_INTERVALS,
	Chromatic: numbers(0, 11)
}

/** Degrees in the order Marbles' Steps control removes them: least stable first to go. */
const DEGREE_IMPORTANCE = [0, 7, 4, 3, 10, 11, 2, 9, 5, 8, 1, 6]

/** Marbles' drum model patterns: 1 is the primary (accented) hit, 2 the secondary hit. */
const DRUM_PATTERNS = [
	[1, 0, 0, 0, 2, 0, 0, 0],
	[0, 0, 1, 0, 2, 0, 0, 0],
	[1, 0, 1, 0, 2, 0, 0, 0],
	[0, 0, 1, 0, 2, 0, 0, 2],
	[1, 0, 1, 0, 2, 0, 1, 0],
	[0, 2, 1, 0, 2, 0, 0, 2],
	[1, 0, 0, 0, 2, 0, 1, 0],
	[0, 2, 1, 0, 2, 0, 1, 2],
	[1, 0, 0, 1, 2, 0, 0, 0],
	[0, 2, 1, 1, 2, 0, 1, 2],
	[1, 0, 0, 1, 2, 0, 1, 0],
	[0, 2, 1, 1, 2, 2, 1, 2],
	[1, 0, 0, 1, 2, 0, 1, 2],
	[0, 2, 0, 1, 2, 0, 1, 2],
	[1, 0, 1, 1, 2, 0, 1, 2],
	[2, 0, 1, 2, 0, 1, 2, 0],
	[1, 2, 1, 1, 2, 0, 1, 2],
	[2, 0, 1, 2, 0, 1, 2, 2]
]

const LOOP_SIZE = 16

/** Seeded uniform generator (mulberry32). */
export function randomStream(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * Marbles' Déjà vu sequence: at 0 every value is fresh, at 0.5 a loop of
 * `length` values repeats exactly, and towards 1 the loop is read in random order.
 */
export class DejaVuSequence {
	private loop: number[]
	private writeHead = 0
	private step = 0
	constructor(private random: () => number) {
		this.loop = Array.from({ length: LOOP_SIZE }, () => random())
	}
	reset(length: number) {
		this.step = length - 1
	}
	next(dejaVu: number, length: number): number {
		const p = (2 * dejaVu - 1) ** 2
		const mutate = this.random() < p
		if (mutate && dejaVu <= 0.5) {
			this.loop[this.writeHead] = this.random()
			this.writeHead = (this.writeHead + 1) % LOOP_SIZE
			this.step = length - 1
		} else if (mutate) {
			this.step = Math.floor(this.random() * length)
		} else {
			this.step = (this.step + 1) % length
		}
		return this.loop[(this.writeHead + LOOP_SIZE - length + (this.step % length)) % LOOP_SIZE]
	}
}

/**
 * Map a uniform value through the X section's distribution: Spread narrows the
 * values to the bias (0), spreads them evenly (0.5) or pushes them to the extremes (1);
 * Bias moves the median.
 */
export function sampleDistribution(uniform: number, spread: number, bias: number): number {
	const centred = 2 * uniform - 1
	const shaped = Math.sign(centred) * Math.abs(centred) ** (2 ** ((0.5 - spread) * 10))
	const median = clamp(bias, 0.01, 0.99)
	return (0.5 + shaped * 0.5) ** (Math.log(median) / Math.log(0.5))
}

/** Pitch classes (relative to the root) left by the Steps control: 0–50% is chromatic. */
export function allowedDegrees(scale: number[], steps: number): number[] {
	if (steps < 50) {
		return numbers(0, 11)
	}
	const ranked = DEGREE_IMPORTANCE.filter((degree) => scale.includes(degree))
	const count = Math.round(ranked.length - ((ranked.length - 1) * (steps - 50)) / 50)
	return ranked.slice(0, Math.max(1, count))
}

export function nearestDegree(pitch: number, root: number, degrees: number[]): number {
	const rounded = Math.round(pitch)
	for (let distance = 0; distance < 12; distance++) {
		for (const candidate of [rounded + distance, rounded - distance]) {
			if (degrees.includes((((candidate - root) % 12) + 12) % 12)) {
				return candidate
			}
		}
	}
	return rounded
}

interface Sampler {
	t: DejaVuSequence
	x: DejaVuSequence
	jitter: () => number
	history: boolean[]
	streak: number
	drumStep: number
	drumPattern: number
}

export class TransformerRandomSampler extends PerformanceTransformer {
	type = ID_RANDOM_SAMPLER
	category = "Variation"
	private samplers = new Map<Voice, Sampler>()
	get name() {
		return "Random Sampler"
	}
	get description() {
		return "Marbles-style random gates and in-scale pitches around each held note, with Déjà vu loops."
	}
	get instructions() {
		return "Hold a note to set the root. Gate model and probability decide when notes play; Spread, Bias and Steps shape which pitches. Déjà vu at 50% locks a repeating loop; lower values let it evolve, higher values shuffle it."
	}
	constructor(config: Settings = {}) {
		super(
			{
				model: "coin",
				probability: 50,
				rate: 0.25,
				jitter: 0,
				gate: 60,
				spread: 50,
				bias: 50,
				steps: 60,
				range: 2,
				scale: "Major",
				dejaVu: 25,
				length: 8,
				seed: 1
			},
			[
				{
					name: "model",
					label: "Gate model",
					values: ["coin", "markov", "drums"],
					help: "Coin tosses each step, Markov learns from its own recent rhythm, Drums picks kick/snare-like patterns."
				},
				{
					name: "probability",
					label: "Gate probability / bias (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100,
					help: "Coin: chance of each step playing. Markov: low values give busy, irregular rhythms; high values sparse rhythms that repeat every eight steps. Drums: distance from 50% picks busier patterns."
				},
				{
					name: "rate",
					label: "Step length (beats)",
					values: [0.125, 0.25, 0.5, 1, 2],
					min: 0.125,
					max: 2
				},
				{
					name: "jitter",
					label: "Timing jitter (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "gate",
					label: "Note length (%)",
					values: [10, 25, 50, 60, 75, 90],
					min: 1,
					max: 95
				},
				{
					name: "spread",
					label: "Pitch spread (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100,
					help: "0% plays the bias pitch, 50% spreads evenly, 100% favours the range extremes."
				},
				{
					name: "bias",
					label: "Pitch bias (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "steps",
					label: "Steps (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100,
					help: "Below 50% any semitone; above 50% only the scale, then fewer, more stable degrees."
				},
				{
					name: "range",
					label: "Range (octaves)",
					values: [1, 2, 3, 4],
					min: 1,
					max: 4
				},
				{ name: "scale", label: "Scale", values: Object.keys(RANDOM_SAMPLER_SCALES) },
				{
					name: "dejaVu",
					label: "Déjà vu (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "length",
					label: "Loop length",
					values: numbers(1, 16),
					min: 1,
					max: 16
				},
				{
					name: "seed",
					label: "Random seed",
					values: numbers(1, 32),
					min: 1,
					max: 2147483647
				}
			],
			config
		)
	}
	protected noteOn(voice: Voice) {
		const random = randomStream(
			Number(this.options.seed) ^ Math.imul(voice.input.number, 2654435761)
		)
		const sampler: Sampler = {
			t: new DejaVuSequence(random),
			x: new DejaVuSequence(random),
			jitter: randomStream(Number(this.options.seed) + 7919),
			history: [],
			streak: 0,
			drumStep: DRUM_PATTERNS[0].length - 1,
			drumPattern: 0
		}
		const length = Math.round(Number(this.options.length))
		sampler.t.reset(length)
		sampler.x.reset(length)
		this.samplers.set(voice, sampler)
		return this.pulse(voice, sampler)
	}
	protected noteOff(voice: Voice, command: IAudioCommand) {
		this.samplers.delete(voice)
		return super.noteOff(voice, command)
	}
	protected clearState() {
		this.samplers?.clear()
	}
	private pulse(voice: Voice, sampler: Sampler): IAudioCommand[] {
		if (voice.released || !this.options.enabled) {
			return []
		}
		const step = beatSeconds(this.timer) * Number(this.options.rate)
		const dejaVu = Number(this.options.dejaVu) / 100
		const length = Math.round(Number(this.options.length))
		const gate = this.gate(sampler, sampler.t.next(dejaVu, length))
		const result: IAudioCommand[] = []
		if (gate) {
			const x = sampleDistribution(
				sampler.x.next(dejaVu, length),
				Number(this.options.spread) / 100,
				Number(this.options.bias) / 100
			)
			const root = voice.input.number
			const degrees = allowedDegrees(
				RANDOM_SAMPLER_SCALES[String(this.options.scale)] ?? IONIAN_INTERVALS,
				Number(this.options.steps)
			)
			const pitch = nearestDegree(
				root + (x - 0.5) * Number(this.options.range) * 12,
				root,
				degrees
			)
			const velocity = voice.input.velocity * (gate === "soft" ? 0.75 : 1)
			const jitter = Number(this.options.jitter) / 100
			const at = this.now + sampler.jitter() * jitter * jitter * 0.5 * step
			const play = () => {
				const on = this.start(voice, pitch, at, velocity)
				this.schedule(
					at + (step * Number(this.options.gate)) / 100,
					() => [this.end(voice, on)],
					voice
				)
				return [on]
			}
			if (at > this.now) {
				this.schedule(at, play, voice)
			} else {
				result.push(...play())
			}
		}
		this.schedule(this.now + step, () => this.pulse(voice, sampler), voice)
		return result
	}
	/** The T section: whether this step plays, and whether it is a secondary (softer) hit. */
	private gate(sampler: Sampler, uniform: number): false | "hard" | "soft" {
		const bias = Number(this.options.probability) / 100
		if (this.options.model === "drums") {
			sampler.drumStep++
			if (sampler.drumStep >= DRUM_PATTERNS[0].length) {
				sampler.drumStep = 0
				let index = Math.floor(DRUM_PATTERNS.length * uniform * 2 * Math.abs(bias - 0.5))
				if (bias <= 0.5) {
					index -= index % 2
				}
				sampler.drumPattern = Math.min(DRUM_PATTERNS.length - 1, index)
			}
			const hit = DRUM_PATTERNS[sampler.drumPattern][sampler.drumStep]
			return hit === 1 ? "hard" : hit === 2 ? "soft" : false
		}
		let state: boolean
		if (this.options.model === "markov") {
			// Marbles' rules: favour repeating 8 steps ago and sparse (non-consecutive) hits.
			const b = 1.5 * bias - 0.5
			const periodic = sampler.history[7] ?? false
			const dense = sampler.history[0] ?? false
			let logit = -1.5 + (sampler.streak > 24 ? 10 : 0)
			logit += 8 * Math.abs(b) * (periodic ? b : -b)
			logit -= dense ? b : 0
			state = uniform < 1 / (1 + Math.exp(-clamp(logit, -10, 10)))
			sampler.history.unshift(state)
			sampler.history.length = Math.min(sampler.history.length, 16)
		} else {
			state = uniform < bias
		}
		sampler.streak = state ? 0 : sampler.streak + 1
		return state ? "hard" : false
	}
}