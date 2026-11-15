import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { beatSeconds, type Settings, type Voice } from "./performance-transformer.ts"
import {
	ChordLoopTransformer,
	COLLECT_CONTROL,
	spreadOctaves,
	type LoopNote,
	type LoopStep
} from "./chord-loop-transformer.ts"
import { Arpeggio, HARP_ARPEGGIO_VARIATION } from "../../timing/arpeggio.ts"

export const ID_ARPEGGIATOR = "Arpeggiator"

const HARP_OCTAVE_SPAN = new Arpeggio().configure(HARP_ARPEGGIO_VARIATION).octaveSpan

/** Length of one step in beats for each rate */
const RATES: Record<string, number> = {
	"1/2": 2,
	"1/4": 1,
	"1/4 triplet": 2 / 3,
	"1/8": 1 / 2,
	triplet: 1 / 3,
	"1/16": 1 / 4,
	"1/16 triplet": 1 / 6,
	"1/32": 1 / 8
}

/** Outermost notes first, working in towards the middle */
const converge = (notes: LoopNote[]) =>
	notes.map((_, index) =>
		index % 2 ? notes[notes.length - 1 - (index >> 1)] : notes[index >> 1]
	)

/**
 * Arpeggiator Transformer
 *
 * Plays the notes of a held chord one after another in time with the tempo,
 * either once (leaving the notes sounding until the keys are released) or
 * over and over for as long as any key is held.
 *
 * Patterns:
 * - up: Notes ascending
 * - down: Notes descending
 * - up-down: Ascend then descend
 * - down-up: Descend then ascend
 * - converge: Lowest, highest, then inwards to the middle
 * - diverge: From the middle outwards
 * - random: Random order, never the same note twice running
 * - chord: All notes at once
 * - harp: Notes ascending through the harp octave span, whatever the octaves setting
 */
export class TransformerArpeggiator extends ChordLoopTransformer {
	type = ID_ARPEGGIATOR
	category = TRANSFORMER_CATEGORY_TIMING
	private last?: LoopNote

	get name() {
		return "Arpeggiator"
	}
	get description() {
		return "Arpeggiate incoming notes based on the selected pattern and rate."
	}
	get instructions() {
		return "Play a chord. With Repeat off its notes play once and ring until the keys are released, even if the keys come up early. With Repeat on they cycle for as long as any key stays down, and keys added or released join or leave the run."
	}
	constructor(config: Settings = {}) {
		super(
			{
				pattern: "up",
				rate: "1/16",
				octaves: 1,
				repeat: 0,
				gate: 80,
				swing: 0,
				accent: 100,
				// Notes that arrive together already form one chord, so nothing is held back.
				collect: 0
			},
			[
				{
					name: "pattern",
					label: "Pattern",
					help: "Choose the order in which held notes play, or Chord to play them together.",
					values: [
						{ name: "Up", value: "up" },
						{ name: "Down", value: "down" },
						{ name: "Up-Down", value: "up-down" },
						{ name: "Down-Up", value: "down-up" },
						{ name: "Converge", value: "converge" },
						{ name: "Diverge", value: "diverge" },
						{ name: "Random", value: "random" },
						{ name: "Chord", value: "chord" },
						{ name: "Harp", value: "harp" }
					]
				},
				{
					name: "rate",
					label: "Rate",
					help: "Set the spacing between notes as a note division synced to the current tempo.",
					values: Object.keys(RATES).map((value) => ({
						name: value === "triplet" ? "1/8 triplet" : value,
						value
					}))
				},
				{
					name: "octaves",
					label: "Octaves",
					help: "Choose how many octaves the pattern spans, starting at the held notes and extending upward.",
					values: [1, 2, 3, 4],
					min: 1,
					max: 4
				},
				{
					name: "repeat",
					label: "Repeat",
					help: "On cycles the pattern while keys are held. Off plays it once and leaves the notes sounding.",
					values: [
						{ name: "On", value: 1 },
						{ name: "Off", value: 0 }
					],
					min: 0,
					max: 1
				},
				{
					name: "gate",
					label: "Note length (%)",
					help: "How much of each step a note fills when Repeat is on.",
					values: [25, 50, 80, 100],
					min: 5,
					max: 100
				},
				{
					name: "swing",
					label: "Swing (%)",
					help: "Lengthen every first step of a pair and shorten the second by this much.",
					values: [0, 10, 20, 33, 50],
					min: 0,
					max: 75
				},
				{
					name: "accent",
					label: "First note velocity (%)",
					help: "Emphasise the note that starts each pass through the pattern.",
					values: [100, 110, 125, 150],
					min: 50,
					max: 200
				},
				COLLECT_CONTROL
			],
			config
		)
	}
	protected override get completes() {
		return !this.options.repeat
	}
	private sequence(chord: Voice[]): LoopNote[] {
		const { pattern } = this.options
		const repeat = Boolean(this.options.repeat)
		const notes = spreadOctaves(
			chord,
			pattern === "harp" ? HARP_OCTAVE_SPAN : Number(this.options.octaves)
		)
		const down = [...notes].reverse()
		// A repeating pattern turns round without sounding its end notes twice.
		const back = (there: LoopNote[], home: LoopNote[]) => [
			...there,
			...home.slice(1, repeat ? -1 : undefined)
		]
		switch (pattern) {
			case "down":
				return down
			case "up-down":
				return back(notes, down)
			case "down-up":
				return back(down, notes)
			case "converge":
				return converge(notes)
			case "diverge":
				return converge(notes).reverse()
			default:
				return notes
		}
	}
	protected step(chord: Voice[], index: number): LoopStep {
		const { pattern } = this.options
		const repeat = Boolean(this.options.repeat)
		const sequence = this.sequence(chord)
		const length = pattern === "chord" ? 1 : sequence.length
		let notes = [sequence[index % length]]
		if (pattern === "chord") {
			notes = sequence
		} else if (pattern === "random") {
			const others = sequence.filter((note) => note.pitch !== this.last?.pitch)
			const choices = others.length ? others : sequence
			notes = [choices[Math.floor(Math.random() * choices.length)]]
		}
		this.last = notes[0]
		const swing = ((index % 2 ? -1 : 1) * Number(this.options.swing)) / 100
		const wait = beatSeconds(this.timer) * RATES[String(this.options.rate)] * (1 + swing)
		const accent = index % length === 0 ? Number(this.options.accent) / 100 : 1
		return {
			notes: notes.map((note) => ({
				...note,
				velocity: note.voice.input.velocity * accent
			})),
			wait,
			length: repeat ? (wait * Number(this.options.gate)) / 100 : Infinity,
			done: !repeat && index >= length - 1
		}
	}
}