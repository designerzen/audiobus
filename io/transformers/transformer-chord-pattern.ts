import { beatSeconds, type Settings, type Voice } from "./performance-transformer.ts"
import { ChordLoopTransformer, COLLECT_CONTROL, type LoopStep } from "./chord-loop-transformer.ts"

export const ID_CHORD_PATTERN = "Chord-Pattern"

/**
 * One character per step: "x" the whole chord, "X" the whole chord accented,
 * "b" the lowest note, "t" the notes above it, "h" the highest note, "1" to "4" a single
 * note counted up from the lowest (wrapping round a smaller chord) and "." a rest.
 */
export const CHORD_PATTERNS: Record<string, { steps: string; perBeat: number }> = {
	pulse: { steps: "X...x...x...x...", perBeat: 4 },
	eighths: { steps: "X.x.x.x.X.x.x.x.", perBeat: 4 },
	sixteenths: { steps: "Xxxxxxxxxxxxxxxx", perBeat: 4 },
	offbeat: { steps: "..x...x...x...x.", perBeat: 4 },
	"bass-chord": { steps: "b...t...b...t...", perBeat: 4 },
	waltz: { steps: "b...t...t...", perBeat: 4 },
	rolling: { steps: "b.t.t.t.b.t.t.t.", perBeat: 4 },
	tresillo: { steps: "X..x..x.X..x..x.", perBeat: 4 },
	clave: { steps: "X..x..x...x.x...", perBeat: 4 },
	gallop: { steps: "X.xxx.xxX.xxx.xx", perBeat: 4 },
	shuffle: { steps: "X.xx.xX.xx.x", perBeat: 3 },
	triplets: { steps: "XxxXxxXxxXxx", perBeat: 3 },
	backbeat: { steps: "b...X...b...X...", perBeat: 4 },
	"push-pull": { steps: "X.....x.x.....x.", perBeat: 4 },
	syncopated: { steps: "X..x.x..x.x..x.x", perBeat: 4 },
	reggae: { steps: "..x.x...x.x...x.", perBeat: 4 },
	bossa: { steps: "b..tb.t..t.b.t..", perBeat: 4 },
	montuno: { steps: "b.t.t.bt.t.tb.t.", perBeat: 4 },
	stride: { steps: "b.t.h.t.b.t.h.t.", perBeat: 4 },
	alberti: { steps: "1.3.2.3.1.3.2.3.", perBeat: 4 },
	"broken-up": { steps: "1.2.3.4.1.2.3.4.", perBeat: 4 },
	"broken-down": { steps: "4.3.2.1.4.3.2.1.", perBeat: 4 },
	fingerpick: { steps: "b.3.2.h.b.2.3.h.", perBeat: 4 },
	"pedal-top": { steps: "h.1.h.2.h.3.h.2.", perBeat: 4 },
	"roll-in": { steps: "123X....123x....", perBeat: 4 },
	"six-eight": { steps: "b.t.t.b.t.t.", perBeat: 3 },
	"long-short": { steps: "X.....x.X.....x.", perBeat: 4 },
	stabs: { steps: "X.......x..x....", perBeat: 4 },
	"double-time": { steps: "b.ttb.ttb.ttb.tt", perBeat: 4 },
	sparse: { steps: "X...........h...", perBeat: 4 }
}

export class TransformerChordPattern extends ChordLoopTransformer {
	type = ID_CHORD_PATTERN
	category = "Pattern"
	get name() {
		return "Chord Pattern"
	}
	get description() {
		return "Replay the held chord in a choice of fixed rhythms, in time with the tempo."
	}
	get instructions() {
		return "Hold a chord. The rhythm repeats for as long as any key stays down, and keeps its place when keys are added or released."
	}
	constructor(config: Settings = {}) {
		super(
			{ pattern: "pulse", speed: 1, gate: 80, accent: 125, collect: 25 },
			[
				{ name: "pattern", label: "Pattern", values: Object.keys(CHORD_PATTERNS) },
				{
					name: "speed",
					label: "Speed",
					values: [0.5, 1, 2],
					min: 0.25,
					max: 4,
					help: "Multiply the speed of the rhythm against the tempo."
				},
				{
					name: "gate",
					label: "Note length (%)",
					values: [25, 50, 80, 100],
					min: 5,
					max: 100
				},
				{
					name: "accent",
					label: "Accent velocity (%)",
					values: [100, 110, 125, 150],
					min: 100,
					max: 200
				},
				COLLECT_CONTROL
			],
			config
		)
	}
	protected step(chord: Voice[], index: number): LoopStep {
		const { steps, perBeat } = CHORD_PATTERNS[String(this.options.pattern)]
		const position = index % steps.length
		const symbol = steps[position]
		const wait = beatSeconds(this.timer) / perBeat / Number(this.options.speed)
		// A note lasts until the next one, however many rests lie between them.
		let span = 1
		while (span < steps.length && steps[(position + span) % steps.length] === ".") {
			span++
		}
		const single = Number(symbol)
		const voices =
			symbol === "."
				? []
				: single
					? [chord[(single - 1) % chord.length]]
					: symbol === "b"
						? chord.slice(0, 1)
						: symbol === "h"
							? chord.slice(-1)
							: symbol === "t" && chord.length > 1
								? chord.slice(1)
								: chord
		return {
			notes: voices.map((voice) => ({
				voice,
				pitch: voice.input.number,
				velocity:
					symbol === "X"
						? (voice.input.velocity * Number(this.options.accent)) / 100
						: voice.input.velocity
			})),
			wait,
			length: (wait * span * Number(this.options.gate)) / 100
		}
	}
}