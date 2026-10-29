import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import { cloneAudioCommand } from "../../audio-command-factory.ts"
import {
	MAGENTA_GENERATE,
	MAGENTA_RESULT,
	MAGENTA_STATUS,
	MAGENTA_ERROR
} from "./magenta-messages.ts"
import type { MelodyNote, MagentaRequest } from "./magenta-messages.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { FieldConfig } from "./interface-transformer.ts"
import type { Timer } from "netronome"

export const ID_MAGENTA = "Magenta-Melody"

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const SCALES: Record<string, number[]> = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	mixolydian: [0, 2, 4, 5, 7, 9, 10],
	chromatic: Array.from({ length: 12 }, (_, i) => i)
}
const DEFAULT_OPTIONS = {
	enabled: 1,
	model: "chord_pitches_improv",
	temperature: 1,
	steps: 32,
	seedNotes: 8,
	root: 0,
	scale: "major",
	chordProgression: "",
	regenerate: 1,
	playbackRate: 1,
	delayBeats: 0,
	gate: 0.8,
	transpose: 0,
	minPitch: 48,
	maxPitch: 84,
	velocity: 0.7,
	channel: 0
}
type Config = typeof DEFAULT_OPTIONS

export class TransformerMagenta extends Transformer<Config> {
	type = ID_MAGENTA
	category = TRANSFORMER_CATEGORY_TUNING
	status = "Play notes to generate a melody. The first use downloads model weights."
	private worker?: Worker
	private requestId = 0
	private busy = false
	private failed = false
	private destroyed = false
	private ready?: MelodyNote[]
	private history: { pitch: number; time: number }[] = []
	private nextPhraseAt = -Infinity

	get name() {
		return "Magenta Melody"
	}
	get instructions() {
		return "Play a few notes while Magenta prepares a melody. When it is ready, play another note to bring in the accompaniment. Your original notes always play through."
	}
	get statusState() {
		if (!this.config.enabled) {
			return "disabled"
		}
		if (this.failed) {
			return "error"
		}
		if (this.busy) {
			return "loading"
		}
		return this.ready ? "ready" : "idle"
	}
	get description() {
		return "Add a musical companion that creates a second melody from your playing. Choose a key, set the mood, and play."
	}

	get fields(): FieldConfig[] {
		const labels: Partial<Record<keyof Config, string>> = {
			enabled: "Accompaniment",
			model: "Generation model",
			temperature: "Creativity",
			steps: "Phrase length",
			seedNotes: "Notes to learn from",
			root: "Key",
			scale: "Scale",
			regenerate: "Next phrase",
			playbackRate: "Speed",
			delayBeats: "Start delay",
			gate: "Note length",
			transpose: "Pitch shift",
			minPitch: "Lowest note",
			maxPitch: "Highest note",
			velocity: "Accompaniment volume",
			channel: "MIDI channel"
		}
		const groups: Record<keyof Config, string> = {
			enabled: "Melody",
			temperature: "Melody",
			steps: "Melody",
			regenerate: "Melody",
			root: "Harmony",
			scale: "Harmony",
			chordProgression: "Harmony",
			playbackRate: "Timing & feel",
			delayBeats: "Timing & feel",
			gate: "Timing & feel",
			velocity: "Timing & feel",
			transpose: "Pitch & routing",
			minPitch: "Pitch & routing",
			maxPitch: "Pitch & routing",
			channel: "Pitch & routing",
			model: "Model settings",
			seedNotes: "Model settings"
		}
		const help: Partial<Record<keyof Config, string>> = {
			temperature: "Lower values stay predictable; higher values explore more unusual ideas.",
			steps: "Length at normal speed. One beat is a quarter note.",
			root: "The tonal home for the generated melody.",
			scale: "Keeps the added notes within this scale. All notes allows every pitch.",
			regenerate: "Create fresh ideas or keep returning to a phrase you like.",
			velocity: "Relative to your playing: 70% gives the added melody a softer touch.",
			channel: "Use a separate channel to send the melody to a different instrument.",
			model: "Harmony-aware follows your chords. Melody continuation follows the input; both use the selected output scale.",
			seedNotes: "How many of your most recent notes shape the next melody."
		}
		const select = (name: keyof Config, values: FieldConfig["values"]): FieldConfig => ({
			name,
			label: labels[name],
			group: groups[name],
			help: help[name],
			type: "select",
			enabled: true,
			values,
			default: this.config?.[name] ?? DEFAULT_OPTIONS[name]
		})
		const percent = (values: number[]) =>
			values.map((value) => ({ name: `${Math.round(value * 100)}%`, value }))
		const pitch = (values: number[]) =>
			values.map((value) => ({
				name: `${ROOTS[value % 12]}${Math.floor(value / 12) - 1} (MIDI ${value})`,
				value
			}))
		return [
			select("enabled", [
				{ name: "On", value: 1 },
				{ name: "Off", value: 0 }
			]),
			select("temperature", [
				{ name: "Repeatable · 0", value: 0 },
				{ name: "Very focused · 0.25", value: 0.25 },
				{ name: "Focused · 0.5", value: 0.5 },
				{ name: "Gentle variation · 0.75", value: 0.75 },
				{ name: "Balanced · 1", value: 1 },
				{ name: "Adventurous · 1.25", value: 1.25 },
				{ name: "Experimental · 1.5", value: 1.5 },
				{ name: "Unpredictable · 2", value: 2 }
			]),
			select(
				"steps",
				[8, 16, 32, 64, 128].map((value) => ({ name: `${value / 4} beats`, value }))
			),
			select("regenerate", [
				{ name: "Create a new melody", value: 1 },
				{ name: "Repeat this melody", value: 0 }
			]),
			select(
				"root",
				ROOTS.map((name, value) => ({ name, value }))
			),
			select("scale", [
				{ name: "Major", value: "major" },
				{ name: "Minor", value: "minor" },
				{ name: "Dorian", value: "dorian" },
				{ name: "Mixolydian", value: "mixolydian" },
				{ name: "All notes (chromatic)", value: "chromatic" }
			]),
			{
				name: "chordProgression",
				label: "Chord progression",
				group: groups.chordProgression,
				help: "Optional: separate chords with commas or spaces. Leave blank to use your key. Used by the harmony-aware model; changes apply when you leave this field.",
				placeholder: "e.g. C, Am, F, G",
				type: "text",
				enabled: true,
				values: [],
				default: this.config?.chordProgression ?? ""
			},
			select(
				"playbackRate",
				[0.25, 0.5, 1, 2, 4].map((value) => ({
					name: value === 1 ? "Normal" : `${value}× speed`,
					value
				}))
			),
			select(
				"delayBeats",
				[0, 0.25, 0.5, 1, 2, 4, 8].map((value) => ({
					name: value === 0 ? "No delay" : `${value} ${value === 1 ? "beat" : "beats"}`,
					value
				}))
			),
			select("gate", percent([0.25, 0.5, 0.75, 0.8, 1])),
			select("velocity", percent([0.1, 0.25, 0.5, 0.7, 0.75, 1])),
			select(
				"transpose",
				[-24, -12, -7, -5, 0, 5, 7, 12, 24].map((value) => ({
					name:
						value === 0
							? "Original pitch"
							: `${value > 0 ? "+" : ""}${value} semitones`,
					value
				}))
			),
			select("minPitch", pitch([0, 24, 36, 48, 60, 72, 84, 96])),
			select("maxPitch", pitch([36, 48, 60, 72, 84, 96, 108, 127])),
			select("channel", [
				{ name: "Follow input", value: 0 },
				...Array.from({ length: 16 }, (_, i) => i + 1)
			]),
			select("model", [
				{ name: "Harmony-aware improvisation", value: "chord_pitches_improv" },
				{ name: "Melody continuation", value: "basic_rnn" }
			]),
			select(
				"seedNotes",
				[1, 2, 4, 8, 16, 32].map((value) => ({
					name: `${value} ${value === 1 ? "note" : "notes"}`,
					value
				}))
			)
		]
	}

	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULT_OPTIONS, ...config })
		// UI select values are strings; normalize persisted configurations too.
		for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof Config)[]) {
			if (typeof DEFAULT_OPTIONS[key] === "number") {
				this.setConfig(key, this.config[key])
			}
		}
	}

	override setConfig(key: string, value: unknown): void {
		const field = key as keyof Config
		if (typeof DEFAULT_OPTIONS[field] === "number") {
			const number = Number(value)
			value = Number.isFinite(number) ? number : DEFAULT_OPTIONS[field]
		}
		super.setConfig(key, value)
		// The base constructor also calls setConfig before subclass state exists.
		if (key in DEFAULT_OPTIONS && this.requestId !== undefined) {
			this.reset()
		}
	}

	transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
		if (!this.config.enabled || this.destroyed) {
			return commands
		}
		const notes = commands.filter(
			(c) => c.type === NOTE_ON && c.velocity > 0 && c.channel !== 10
		)
		if (!notes.length) {
			return commands
		}
		for (const note of notes) {
			this.history.push({ pitch: note.number, time: note.startAt ?? timer.now })
		}
		this.history = this.history.sort((a, b) => a.time - b.time).slice(-this.config.seedNotes)
		const trigger = notes[0]
		const now = trigger.startAt ?? timer.now
		let result = commands
		if (this.ready && now >= this.nextPhraseAt) {
			result = [...commands, ...this.schedule(this.ready, trigger, timer.bpm)]
			const secondsPerStep = 60 / timer.bpm / 4 / this.config.playbackRate
			this.nextPhraseAt =
				now + (this.config.delayBeats * 60) / timer.bpm + this.config.steps * secondsPerStep
			if (this.config.regenerate) {
				this.ready = undefined
			}
		}
		if (!this.ready && !this.busy && !this.failed) {
			this.generate(timer.bpm)
		}
		return result
	}

	private generate(bpm: number): void {
		this.busy = true
		try {
			if (!this.worker) {
				this.worker = new Worker(new URL("./magenta.worker.ts", import.meta.url), {
					type: "module"
				})
				this.worker.onmessage = ({ data }) => {
					if (data.id !== this.requestId) {
						return
					}
					if (data.kind === MAGENTA_STATUS) {
						this.status = data.status
					}
					if (data.kind === MAGENTA_RESULT) {
						this.busy = false
						this.ready = data.notes
						this.status = data.notes.length
							? "Melody ready — play a note to start the next phrase."
							: "Generated a rest. Play again to generate another phrase."
						if (!data.notes.length) {
							this.ready = undefined
						}
					}
					if (data.kind === MAGENTA_ERROR) {
						this.fail(data.error)
					}
				}
				this.worker.onerror = () => this.fail("Unable to start the Magenta worker.")
			}
			const stepSeconds = 60 / bpm / 4
			const origin = this.history[0].time
			const notes: MelodyNote[] = []
			for (const input of this.history) {
				const step = Math.max(
					0,
					Math.min(127, Math.round((input.time - origin) / stepSeconds))
				)
				const previous = notes.at(-1)
				// MusicRNN takes a monophonic primer; use the last note of a chord.
				if (previous && previous.quantizedStartStep === step) {
					notes.pop()
				} else if (previous) {
					previous.quantizedEndStep = step
				}
				notes.push({
					pitch: input.pitch,
					quantizedStartStep: step,
					quantizedEndStep: step + 1
				})
			}
			const chords = this.config.chordProgression
				.trim()
				.split(/[\s,]+/)
				.filter(Boolean)
			const request: MagentaRequest = {
				kind: MAGENTA_GENERATE,
				id: ++this.requestId,
				model: this.config.model,
				notes,
				totalQuantizedSteps: notes.at(-1)!.quantizedEndStep,
				steps: this.config.steps,
				temperature: this.config.temperature,
				chords: chords.length
					? chords
					: [
							ROOTS[this.config.root] +
								(["minor", "dorian"].includes(this.config.scale) ? "m" : "")
						]
			}
			this.status = "Preparing supplementary melody…"
			this.worker.postMessage(request)
		} catch (error) {
			this.fail(String(error))
		}
	}

	private schedule(notes: MelodyNote[], trigger: IAudioCommand, bpm: number): IAudioCommand[] {
		const stepSeconds = 60 / bpm / 4 / this.config.playbackRate
		const base = trigger.startAt + (this.config.delayBeats * 60) / bpm
		const low = Math.min(this.config.minPitch, this.config.maxPitch)
		const high = Math.max(this.config.minPitch, this.config.maxPitch)
		const scale = SCALES[this.config.scale] ?? SCALES.major
		const pitches = Array.from({ length: high - low + 1 }, (_, i) => i + low).filter((p) =>
			scale.includes((p - this.config.root + 120) % 12)
		)
		if (!pitches.length) {
			return []
		}
		const output: IAudioCommand[] = []
		for (const note of notes) {
			if (
				!Number.isFinite(note.pitch) ||
				!(note.quantizedEndStep > note.quantizedStartStep)
			) {
				continue
			}
			const pitch = note.pitch + this.config.transpose
			const number = pitches.reduce((a, b) =>
				Math.abs(b - pitch) < Math.abs(a - pitch) ? b : a
			)
			const startAt = base + note.quantizedStartStep * stepSeconds
			const endAt =
				startAt +
				(note.quantizedEndStep - note.quantizedStartStep) * stepSeconds * this.config.gate
			const on = cloneAudioCommand(trigger)
			// Native MIDI payloads describe the input note, not the generated note.
			delete on.ump
			delete on.umpOriginal
			on.raw = new Uint8Array()
			Object.assign(on, {
				type: NOTE_ON,
				subtype: NOTE_ON,
				number,
				value: number,
				startAt,
				time: startAt,
				endAt,
				channel: this.config.channel || trigger.channel,
				velocity: Math.max(
					1,
					Math.min(127, Math.round(trigger.velocity * this.config.velocity))
				)
			})
			output.push(on, {
				...on,
				type: NOTE_OFF,
				subtype: NOTE_OFF,
				startAt: endAt,
				time: endAt,
				velocity: 0
			})
		}
		return output.sort((a, b) => a.startAt - b.startAt)
	}

	private fail(error: string): void {
		this.busy = false
		this.failed = true
		this.status = `Magenta unavailable: ${error} Change a setting to retry.`
		this.worker?.terminate()
		this.worker = undefined
	}

	reset(): void {
		this.requestId++
		this.worker?.terminate()
		this.worker = undefined
		this.busy = false
		this.failed = false
		this.ready = undefined
		this.history = []
		this.nextPhraseAt = -Infinity
		this.status = "Play notes to generate a melody. The first use downloads model weights."
	}

	destroy(): void {
		this.reset()
		this.destroyed = true
	}
}