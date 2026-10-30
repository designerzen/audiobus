import { PerformanceTransformer, type Settings, type Voice } from "./performance-transformer"
import { chordAt, DEFAULT_CHORDS, parseProgression, type ChordStep } from "../music-tools"
import { pitchClasses, quantisePitchSet, mod12 } from "../../tuning/pitch-class-set"

export const ID_CHORD_TRACK = "Shared-Chord-Track"
export class TransformerChordTrack extends PerformanceTransformer {
	type = ID_CHORD_TRACK
	category = "Harmony"
	beat = 0
	private progression: ChordStep[] = structuredClone(DEFAULT_CHORDS)
	get name() {
		return "Shared Chord Track"
	}
	get description() {
		return "Follow the workspace chord track as melody, bass or chords. Held notes keep their original releases."
	}
	constructor(config: Settings = {}) {
		super(
			{ role: "melody", transpose: 0, progression: JSON.stringify(DEFAULT_CHORDS) },
			[
				{ name: "role", label: "Follow as", values: ["melody", "bass", "chords"] },
				{
					name: "transpose",
					label: "Transpose (semitones)",
					values: [-24, -12, 0, 12, 24],
					min: -48,
					max: 48
				}
			],
			config
		)
		this.progression = parseProgression(JSON.parse(String(this.options.progression)))
	}
	setProgression(steps: ChordStep[]): void {
		this.progression = parseProgression(steps)
		this.setConfig("progression", JSON.stringify(this.progression))
	}
	setMusicalBeat(beat: number): void {
		this.beat = beat
	}
	protected noteOn(voice: Voice) {
		const chord = chordAt(this.progression, this.beat)
		const transpose = Math.round(Number(this.options.transpose))
		const input = voice.input.number
		const nearest = quantisePitchSet(input, chord.mask, 0)
		if (nearest === undefined) {
			return []
		}
		const notes =
			this.options.role === "chords"
				? pitchClasses(chord.mask).map((pitch) => Math.floor(input / 12) * 12 + pitch)
				: [this.options.role === "bass" ? input - mod12(input - chord.root) : nearest]
		return notes
			.map((pitch) => pitch + transpose)
			.filter((pitch) => pitch >= 0 && pitch <= 127)
			.map((pitch) => this.start(voice, pitch))
	}
	protected clearState() {
		this.beat = 0
	}
}