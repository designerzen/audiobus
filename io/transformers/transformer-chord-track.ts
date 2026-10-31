import { devicePanel } from "../device-controls"
import { PerformanceTransformer, type Settings, type Voice } from "./performance-transformer"
import { chordAt, DEFAULT_CHORDS, parseProgression, type ChordStep } from "../music-tools"
import { pitchClasses, quantisePitchSet, mod12 } from "../../tuning/pitch-class-set"
import { DEFAULT_HARMONY, parseHarmony, type HarmonicState } from "../harmony"

export const ID_CHORD_TRACK = "Shared-Chord-Track"
export class TransformerChordTrack extends PerformanceTransformer {
	type = ID_CHORD_TRACK
	category = "Harmony"
	beat = 0
	private harmony = { ...DEFAULT_HARMONY }
	setHarmony(state: HarmonicState): void {
		this.harmony = parseHarmony(state)
	}
	private gui?: HTMLElement
	private editor?: { refresh(): void; destroy(): void }
	mountProgression?: (
		host: HTMLElement,
		status: HTMLElement
	) => { refresh(): void; destroy(): void }
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			status = document.createElement("p")
		status.setAttribute("role", "status")
		this.editor = this.mountProgression?.(panel, status)
		this.editor?.refresh()
		panel.append(status)
		return (this.gui = panel)
	}
	destroyGui(): void {
		this.editor?.destroy()
		this.editor = undefined
		this.gui?.remove()
		this.gui = undefined
	}
	override destroy(): void {
		this.destroyGui()
		super.destroy()
	}
	private progression: ChordStep[] = structuredClone(DEFAULT_CHORDS)
	get name() {
		return "Shared Chord Track"
	}
	get description() {
		return "Follow the workspace chord track as melody, bass or chords. Held notes keep their original releases."
	}
	constructor(config: Settings = {}) {
		super(
			{
				role: "melody",
				follow: "chord",
				source: "track",
				transpose: 0,
				progression: JSON.stringify(DEFAULT_CHORDS)
			},
			[
				{
					name: "source",
					label: "Harmony source",
					values: ["track", "live"],
					help: "Track uses the chord progression. Live follows the Harmony workspace or conductor."
				},
				{ name: "follow", label: "Melody follows", values: ["chord", "scale"] },
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
		const step = chordAt(this.progression, this.beat)
		const live = this.options.source === "live"
		const chord = live
			? { mask: this.harmony.chord, root: this.harmony.root, scale: this.harmony.scale }
			: step
		const transpose = Math.round(Number(this.options.transpose))
		const input = voice.input.number
		const mask =
			this.options.role === "melody" && this.options.follow === "scale"
				? (chord.scale ?? this.harmony.scale)
				: chord.mask
		const nearest = quantisePitchSet(input, mask, 0)
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