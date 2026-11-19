import {
	PerformanceTransformer,
	beatSeconds,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import { randomStream } from "./transformer-random-sampler.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"

/**
 * Topographic drum sequencing in the manner of Mutable Instruments Grids: a map
 * of drum patterns is read at an X/Y position, and each step's interpolated
 * level is compared with a per-instrument density threshold. The map below is
 * original to HarmonEasy; Grids' own pattern data is not used.
 */
export const ID_TOPOGRAPHIC_DRUMS = "Topographic-Drums"

export const TOPOGRAPHIC_STEPS = 32
export const ACCENT_LEVEL = 192
const INSTRUMENTS = ["kick", "snare", "hat"] as const

/**
 * A 3×3 map, rows by Y and columns by X. Each instrument lists 32 sixteenth-note
 * levels (two bars): 9 is a core hit, lower digits appear as density rises.
 */
const MAP: string[][][] = [
	[
		// Sparse
		[
			"90010030700010009001003070001020",
			"00002000900000100000200090001030",
			"50205020502050205020502050205030"
		],
		// Four on the floor
		[
			"90009000900090009000900090009020",
			"00007000000070000000700000007030",
			"10901090109010901090109010901093"
		],
		// Driving techno
		[
			"90009000900090009000900090009030",
			"00005000000050000000500000305000",
			"73757375737573757375737573757379"
		]
	],
	[
		// Half-time
		[
			"90000009003000009000000700900020",
			"00000000900000000000000090000300",
			"70507050705070507050705070507350"
		],
		// Backbeat
		[
			"90000050900000009000005090300020",
			"00009000000090000000900000009030",
			"70707070707070707070707070707079"
		],
		// Breakbeat
		[
			"90500000009500000090000000900030",
			"00009002000090020200900200009060",
			"73737373737373737373737373737379"
		]
	],
	[
		// One drop
		[
			"00000000900000000000000090000020",
			"00000000900000000000000090000030",
			"30603060306030603060306030603069"
		],
		// Two-step
		[
			"90000000009000009000000000903000",
			"00009000000090000000900000009030",
			"70707070707070707373737373737373"
		],
		// Busy
		[
			"90305030903050309030503090305039",
			"00509030050090303050903005009053",
			"95959595959595959595959595959599"
		]
	]
]

/** Level (0–255) of one instrument at a step, bilinearly interpolated across the map. */
export function topographicLevel(x: number, y: number, instrument: number, step: number): number {
	const level = (row: number, column: number) =>
		(Number(MAP[row][column][instrument][step % TOPOGRAPHIC_STEPS]) * 255) / 9
	const column = Math.min(1, Math.floor(x * 2)),
		row = Math.min(1, Math.floor(y * 2))
	const fx = x * 2 - column,
		fy = y * 2 - row
	const top = level(row, column) * (1 - fx) + level(row, column + 1) * fx
	const bottom = level(row + 1, column) * (1 - fx) + level(row + 1, column + 1) * fx
	return top * (1 - fy) + bottom * fy
}

export const TOPOGRAPHIC_MAP = MAP

interface Pattern {
	drivers: Voice[]
	step: number
	nextAt: number
	random: () => number
}

export class TransformerTopographicDrums extends PerformanceTransformer {
	type = ID_TOPOGRAPHIC_DRUMS
	category = "Pattern"
	private patterns = new Map<string, Pattern>()
	get name() {
		return "Topographic Drums"
	}
	get description() {
		return "Grids-style drum sequencer: hold a note to play kick, snare and hats read from a morphing X/Y map."
	}
	get instructions() {
		return "Hold any note to run the pattern; further held notes keep it going. Map X and Y morph between styles, each density brings in more hits, and Chaos adds random variations."
	}
	constructor(config: Settings = {}) {
		super(
			{
				mapX: 50,
				mapY: 50,
				kickDensity: 50,
				snareDensity: 50,
				hatDensity: 50,
				chaos: 0,
				rate: 0.25,
				soft: 70,
				kick: 36,
				snare: 38,
				hat: 42,
				channel: 10,
				seed: 1
			},
			[
				{ name: "mapX", label: "Map X (%)", values: numbers(0, 100, 5), min: 0, max: 100 },
				{ name: "mapY", label: "Map Y (%)", values: numbers(0, 100, 5), min: 0, max: 100 },
				{
					name: "kickDensity",
					label: "Kick density (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "snareDensity",
					label: "Snare density (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{
					name: "hatDensity",
					label: "Hi-hat density (%)",
					values: numbers(0, 100, 5),
					min: 0,
					max: 100
				},
				{ name: "chaos", label: "Chaos (%)", values: numbers(0, 100, 5), min: 0, max: 100 },
				{
					name: "rate",
					label: "Step length (beats)",
					values: [0.125, 0.25, 0.5],
					min: 0.125,
					max: 0.5
				},
				{
					name: "soft",
					label: "Unaccented velocity (%)",
					values: [25, 50, 70, 85, 100],
					min: 1,
					max: 100
				},
				{ name: "kick", label: "Kick note", values: numbers(0, 127), min: 0, max: 127 },
				{ name: "snare", label: "Snare note", values: numbers(0, 127), min: 0, max: 127 },
				{ name: "hat", label: "Hi-hat note", values: numbers(0, 127), min: 0, max: 127 },
				{
					name: "channel",
					label: "Drum channel",
					values: numbers(0, 16),
					min: 0,
					max: 16,
					help: "0 keeps the held note's channel."
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
		const route = routeKey(voice.input)
		let pattern = this.patterns.get(route)
		if (pattern) {
			pattern.drivers.push(voice)
			return []
		}
		pattern = {
			drivers: [voice],
			step: 0,
			nextAt: this.now,
			random: randomStream(Number(this.options.seed))
		}
		this.patterns.set(route, pattern)
		return this.pulse(voice, pattern)
	}
	protected noteOff(voice: Voice, command: IAudioCommand) {
		const route = routeKey(voice.input)
		const pattern = this.patterns.get(route)
		const result = super.noteOff(voice, command)
		if (pattern?.drivers.includes(voice)) {
			const driving = pattern.drivers[0] === voice
			pattern.drivers = pattern.drivers.filter((driver) => driver !== voice)
			const next = pattern.drivers[0]
			if (!next) {
				this.patterns.delete(route)
			} else if (driving) {
				// Keep the groove's position when another held note takes over.
				this.schedule(pattern.nextAt, () => this.pulse(next, pattern), next)
			}
		}
		return result
	}
	protected clearState() {
		this.patterns?.clear()
	}
	protected clearRoute(route: string) {
		this.patterns.delete(route)
		return []
	}
	private pulse(voice: Voice, pattern: Pattern): IAudioCommand[] {
		if (voice.released || !this.options.enabled) {
			return []
		}
		const length = beatSeconds(this.timer) * Number(this.options.rate)
		const x = Number(this.options.mapX) / 100,
			y = Number(this.options.mapY) / 100
		const chaos = Number(this.options.chaos) / 100
		const channel = Math.round(Number(this.options.channel))
		const result: IAudioCommand[] = []
		INSTRUMENTS.forEach((instrument, index) => {
			const level =
				topographicLevel(x, y, index, pattern.step) + pattern.random() * chaos * 64
			const density = Number(this.options[`${instrument}Density`]) / 100
			if (density > 0 && level > 255 * (1 - density)) {
				const velocity =
					voice.input.velocity *
					(level > ACCENT_LEVEL ? 1 : Number(this.options.soft) / 100)
				const on = this.start(voice, Number(this.options[instrument]), this.now, velocity)
				if (channel > 0) {
					on.channel = channel
				}
				result.push(on)
				this.schedule(this.now + length / 2, () => [this.end(voice, on)], voice)
			}
		})
		pattern.step = (pattern.step + 1) % TOPOGRAPHIC_STEPS
		pattern.nextAt = this.now + length
		this.schedule(pattern.nextAt, () => this.pulse(voice, pattern), voice)
		return result
	}
}