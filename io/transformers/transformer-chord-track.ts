import { devicePanel } from "../device-controls"
import { PerformanceTransformer, copyCommand, noteKey, type Settings, type Voice } from "./performance-transformer"
import { PER_NOTE_CONTROLLER, PER_NOTE_PITCH_BEND } from "../../commands/commands"
import { POLYPHONIC_PRESSURE } from "../../midi/midi-command-conversion"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import { chordAt, DEFAULT_CHORDS, parseProgression, type ChordStep } from "../music-tools"
import { pitchClasses, quantisePitchSet, mod12 } from "../../tuning/pitch-class-set"
import { DEFAULT_HARMONY, parseHarmony, type HarmonicState } from "../harmony"

const WHITE_KEY_INDEX: Record<number, number> = {
	0: 0, // C
	2: 1, // D
	4: 2, // E
	5: 3, // F
	7: 4, // G
	9: 5, // A
	11: 6 // B
}

function closestFifthPitchClass(tones: readonly number[], root: number): number {
	let best = mod12(root + 7)
	let bestDistance = 12
	for (const pc of tones) {
		const interval = mod12(pc - root)
		const distance = Math.min(Math.abs(interval - 7), 12 - Math.abs(interval - 7))
		if (distance < bestDistance) {
			bestDistance = distance
			best = pc
		}
	}
	return best
}

function whiteKeyStep(midiNote: number): number | undefined {
	const index = WHITE_KEY_INDEX[mod12(midiNote)]
	if (index === undefined) {
		return
	}
	const octave = Math.floor(midiNote / 12) - 5 // Middle C (60) -> step 0
	return octave * 7 + index
}

export const ID_CHORD_TRACK = "Shared-Chord-Track"
export class TransformerChordTrack extends PerformanceTransformer {
	type = ID_CHORD_TRACK
	category = "Harmony"
	beat = 0
	private harmony: HarmonicState = { ...DEFAULT_HARMONY }
	setHarmony(state: HarmonicState): void {
		this.harmony = parseHarmony(state)
		if (Number(this.options.repitch) === 1 && this.voices.size > 0) {
			this.schedule(this.now, () => this.repitchHeldVoices())
		}
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
		panel.append(await super.createGui())
		status.setAttribute("role", "status")
		this.editor = this.mountProgression?.(panel, status)
		this.editor?.refresh()
		panel.append(status)
		return (this.gui = panel)
	}
	destroyGui(): void {
		super.destroyGui()
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
				mapping: "nearest",
				repitch: 0,
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
				{ name: "follow", label: "Melody follows", values: ["chord", "scale", "free"] },
				{ name: "role", label: "Follow as", values: ["melody", "bass", "chords"] },
				{
					name: "mapping",
					label: "Key mapping",
					values: [
						{ name: "Nearest tone", value: "nearest" },
						{ name: "White keys (chord palette)", value: "white-keys" },
						{ name: "White keys (root & fifth)", value: "root-fifth" }
					],
					help: "White-key modes ignore black keys and map white keys into fixed-octave chord tones or root/fifth bass groups."
				},
				{
					name: "repitch",
					label: "Held notes on change",
					values: [
						{ name: "Keep sounding", value: 0 },
						{ name: "Re-pitch into new chord", value: 1 }
					]
				},
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
	private targetPitches(input: number): number[] {
		if (this.options.follow === "free") return [input]
		const step = chordAt(this.progression, this.beat)
		const live = this.options.source === "live"
		const chord = live
			? {
					mask: this.harmony.chord,
					root: this.harmony.chordRoot ?? this.harmony.root,
					scale: this.harmony.scale,
					bass: this.harmony.bass
				}
			: { ...step, bass: undefined }
		const transpose = Math.round(Number(this.options.transpose))
		const mapping = String(this.options.mapping ?? "nearest")
		const mask =
			this.options.role === "melody" && this.options.follow === "scale"
				? (chord.scale ?? this.harmony.scale)
				: chord.mask

		let notes: number[]
		if (mapping === "white-keys" || mapping === "root-fifth") {
			const stepIndex = whiteKeyStep(input)
			if (stepIndex === undefined) {
				return []
			}
			const tones = pitchClasses(mask)
			if (!tones.length) {
				return []
			}
			if (mapping === "root-fifth") {
				const bassPc = chord.bass ?? chord.root
				const fifthPc = closestFifthPitchClass(tones, chord.root)
				const group = Math.floor(stepIndex / 3)
				const octaveShift = Math.floor(group / 2)
				const isFifth = ((group % 2) + 2) % 2 === 1
				const pc = isFifth ? fifthPc : bassPc
				const octaveOffset = isFifth && fifthPc < bassPc ? 1 : 0
				notes = [60 + (octaveShift + octaveOffset) * 12 + pc]
			} else {
				// Fixed-octave chord tones sorted upward from C so shared tones stay under the same fingers.
				const len = tones.length
				const octaveShift = Math.floor(stepIndex / len)
				const index = ((stepIndex % len) + len) % len
				notes = [60 + octaveShift * 12 + tones[index]]
			}
		} else {
			const nearest = quantisePitchSet(input, mask, 0)
			if (nearest === undefined) {
				return []
			}
			const bassRoot = chord.bass ?? chord.root
			notes =
				this.options.role === "chords"
					? pitchClasses(chord.mask).map((pitch) => Math.floor(input / 12) * 12 + pitch)
					: [this.options.role === "bass" ? input - mod12(input - bassRoot) : nearest]
		}
		return notes
			.map((pitch) => pitch + transpose)
			.filter((pitch) => pitch >= 0 && pitch <= 127)
	}
	private repitchHeldVoices() {
		const noteOffs = []
		const noteOns = []
		for (const voice of this.voices) {
			if (voice.released) {
				continue
			}
			const desired = new Set(this.targetPitches(voice.input.number))
			const currentTargets = [...voice.targets]
			const kept = new Set<number>()
			for (const target of currentTargets) {
				if (desired.has(target.number)) {
					kept.add(target.number)
				} else {
					noteOffs.push(this.end(voice, target, this.now))
				}
			}
			for (const pitch of desired) {
				if (!kept.has(pitch)) {
					noteOns.push(this.start(voice, pitch, this.now, voice.input.velocity))
				}
			}
		}
		// Send all note-offs before note-ons so mono/poly synths never stick or overlap.
		return [...noteOffs, ...noteOns]
	}
	protected noteOn(voice: Voice) {
		return this.targetPitches(voice.input.number).map((pitch) => this.start(voice, pitch))
	}
	protected override noteOff(voice: Voice, command: IAudioCommand): IAudioCommand[] {
		return this.release(voice, command.startAt).map(target => copyCommand(command, { number: target.number }))
	}
	protected override other(command: IAudioCommand): IAudioCommand[] {
		if (![PER_NOTE_CONTROLLER, PER_NOTE_PITCH_BEND, POLYPHONIC_PRESSURE].includes(command.type)) return [command]
		const targets = new Set<number>()
		for (const voice of this.voices) {
			if (!voice.released && noteKey(voice.input) === noteKey(command)) {
				for (const target of voice.targets) targets.add(target.number)
			}
		}
		return [...targets].map(number => copyCommand(command, { number }))
	}
	protected clearState() {
		this.beat = 0
	}
}
