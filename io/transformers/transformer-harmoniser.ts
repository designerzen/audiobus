import { Transformer, type TransformerConfig } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import type { Timer } from "netronome"
import type { FieldConfig } from "./interface-transformer.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"
import { NOTE_OFF, CONTROL_CHANGE } from "../../commands/commands"
import { copyCommand, isNoteOn, isNoteOff, noteKey, routeKey } from "./performance-transformer"
import { mod12, quantisePitchSet } from "../../tuning/pitch-class-set"
import {
	IONIAN_INTERVALS,
	DORIAN_INTERVALS,
	PHRYGIAN_INTERVALS,
	LYDIAN_INTERVALS,
	MIXOLYDIAN_INTERVALS,
	AEOLIAN_INTERVALS,
	LOCRIAN_INTERVALS,
	MAJOR_PENTATONIC_INTERVALS,
	MINOR_PENTATONIC_INTERVALS,
	BLUES_SCALE_INTERVALS
} from "../../tuning/intervals"

export const ID_HARMONISER = "Harmoniser"
const NOTE_NAMES = [
	"C",
	"C♯ / D♭",
	"D",
	"D♯ / E♭",
	"E",
	"F",
	"F♯ / G♭",
	"G",
	"G♯ / A♭",
	"A",
	"A♯ / B♭",
	"B"
]
const SCALES = [
	{ name: "Major (Ionian)", value: IONIAN_INTERVALS },
	{ name: "Natural minor (Aeolian)", value: AEOLIAN_INTERVALS },
	{ name: "Harmonic minor", value: [0, 2, 3, 5, 7, 8, 11] },
	{ name: "Melodic minor (ascending)", value: [0, 2, 3, 5, 7, 9, 11] },
	{ name: "Major pentatonic", value: MAJOR_PENTATONIC_INTERVALS },
	{ name: "Minor pentatonic", value: MINOR_PENTATONIC_INTERVALS },
	{ name: "Blues", value: BLUES_SCALE_INTERVALS },
	{ name: "Dorian", value: DORIAN_INTERVALS },
	{ name: "Phrygian", value: PHRYGIAN_INTERVALS },
	{ name: "Lydian", value: LYDIAN_INTERVALS },
	{ name: "Mixolydian", value: MIXOLYDIAN_INTERVALS },
	{ name: "Locrian", value: LOCRIAN_INTERVALS },
	{ name: "Whole tone", value: [0, 2, 4, 6, 8, 10] },
	{ name: "Chromatic", value: Array.from({ length: 12 }, (_, i) => i) }
]
interface Config extends TransformerConfig {
	root: number
	mode: number[]
	direction: string
}
const DEFAULT_OPTIONS: Config = { root: 0, mode: IONIAN_INTERVALS, direction: "nearest" }

/** Snap notes into a key, remembering each attack's pitch until its release. */
export class TransformerHarmoniser extends Transformer<Config> {
	type = ID_HARMONISER
	category = TRANSFORMER_CATEGORY_TUNING
	readonly handlesMidiControls = true
	private held = new Map<string, Array<IAudioCommand | undefined>>()
	private sounding = new Map<string, { command: IAudioCommand; count: number }>()
	private guiSubscription?: () => void
	private summary?: HTMLElement
	private mask = 2741
	notesInScale = new Set<number>()

	get name() {
		return "Harmoniser"
	}
	get description() {
		return "Snap incoming notes into your chosen key and scale."
	}
	get fields(): FieldConfig[] {
		return [
			{
				name: "enabled",
				label: "Enabled",
				type: "select",
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				],
				default: 1
			},
			{
				name: "root",
				label: "Key",
				group: "Key and scale",
				type: "select",
				values: NOTE_NAMES.map((name, value) => ({ name, value })),
				default: 0,
				help: "The tonic of the scale. Notes keep their register wherever possible."
			},
			{
				name: "mode",
				label: "Scale",
				group: "Key and scale",
				type: "select",
				values: SCALES,
				default: IONIAN_INTERVALS
			},
			{
				name: "direction",
				label: "Out-of-scale notes",
				group: "Note mapping",
				type: "select",
				values: [
					{ name: "Nearest scale note", value: "nearest" },
					{ name: "Snap upwards", value: "up" },
					{ name: "Snap downwards", value: "down" },
					{ name: "Only pass scale notes", value: "filter" }
				],
				default: "nearest",
				help: "Nearest ties go down. Up/down omit notes with no valid target in MIDI range. Held notes keep their original mapping when you change the scale."
			}
		]
	}
	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULT_OPTIONS, ...config })
		this.setConfig("root", this.config.root)
		this.setConfig("mode", this.config.mode)
		this.setConfig("direction", this.config.direction)
	}
	override setConfig(key: string, value: unknown): void {
		if (key === "root") {
			const root = Number(value)
			value = Number.isFinite(root) ? mod12(Math.round(root)) : 0
		}
		if (key === "mode") {
			// Older presets and surfaces may encode interval arrays as comma-separated strings.
			const intervals = Array.isArray(value)
				? value
				: typeof value === "string"
					? value.split(",").map(Number)
					: []
			value =
				intervals.length && intervals.every((n) => Number.isInteger(n) && n >= 0 && n < 12)
					? [...new Set(intervals)].sort((a, b) => a - b)
					: [...IONIAN_INTERVALS]
		}
		if (key === "direction" && !["nearest", "up", "down", "filter"].includes(String(value))) {
			value = "nearest"
		}
		if (key === "enabled") {
			// Keep saved 0/1 values numeric; switches write booleans only to boolean configs.
			value = typeof value === "boolean" ? value : Number(value) === 1 ? 1 : 0
		}
		super.setConfig(key, value)
		// The base constructor calls setConfig before instance fields are initialized.
		if (this.notesInScale && (key === "root" || key === "mode")) {
			this.mask = this.config.mode.reduce((mask, pitch) => mask | (1 << pitch), 0)
			this.notesInScale = new Set(
				Array.from({ length: 128 }, (_, n) => n).filter(
					(n) => this.mask & (1 << mod12(n - this.config.root))
				)
			)
		}
	}
	transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
		const result: IAudioCommand[] = []
		for (const command of commands) {
			if (command.type === CONTROL_CHANGE && [120, 123].includes(command.number)) {
				const route = routeKey(command)
				for (const [key, active] of this.sounding) {
					if (routeKey(active.command) === route) {
						result.push(
							copyCommand(active.command, {
								type: NOTE_OFF,
								subtype: NOTE_OFF,
								velocity: 0,
								startAt: command.startAt
							})
						)
						this.sounding.delete(key)
					}
				}
				for (const key of this.held.keys()) {
					if (key.startsWith(`${route}:`)) {
						this.held.delete(key)
					}
				}
				result.push(command)
			} else if (isNoteOff(command)) {
				const key = noteKey(command)
				const queue = this.held.get(key)
				if (!queue) {
					result.push(command)
					continue
				}
				const target = queue.shift()
				if (!queue.length) {
					this.held.delete(key)
				}
				if (!target) {
					continue
				}
				const outputKey = noteKey(target)
				const active = this.sounding.get(outputKey)
				if (active && --active.count === 0) {
					this.sounding.delete(outputKey)
					result.push(copyCommand(command, { number: target.number }))
				}
			} else if (isNoteOn(command)) {
				const pitch = this.config.enabled
					? quantisePitchSet(
							command.number,
							this.mask,
							this.config.root,
							this.config.direction
						)
					: command.number
				const target =
					pitch === undefined ? undefined : copyCommand(command, { number: pitch })
				const key = noteKey(command)
				const queue = this.held.get(key) ?? []
				queue.push(target)
				this.held.set(key, queue)
				if (!target) {
					continue
				}
				const outputKey = noteKey(target)
				const active = this.sounding.get(outputKey)
				if (active) {
					active.count++
				} else {
					this.sounding.set(outputKey, { command: target, count: 1 })
					result.push(target)
				}
			} else {
				result.push(command)
			}
		}
		return result
	}
	override async createGui(): Promise<HTMLElement> {
		const element = await super.createGui()
		if (!this.summary) {
			this.summary = document.createElement("section")
			this.summary.setAttribute("aria-label", "Selected scale")
			this.summary.setAttribute("aria-live", "polite")
			this.summary.style.cssText =
				"padding:12px;border:1px solid currentColor;border-radius:8px;margin-bottom:12px;line-height:1.6"
			element.prepend(this.summary)
			const update = () => {
				const title = document.createElement("strong")
				const scale = SCALES.find((scale) => scale.value.join() === this.config.mode.join())
				title.textContent = `${NOTE_NAMES[this.config.root]} · ${scale?.name ?? "Custom scale"}`
				const notes = document.createElement("div")
				notes.textContent = this.config.mode
					.map((pitch) => NOTE_NAMES[mod12(pitch + this.config.root)])
					.join(" · ")
				this.summary!.replaceChildren(title, notes)
			}
			this.guiSubscription = this.subscribeControls(update)
			update()
		}
		return element
	}
	override destroyGui(): void {
		this.guiSubscription?.()
		this.guiSubscription = undefined
		this.summary = undefined
		super.destroyGui()
	}
	stop(now: number): IAudioCommand[] {
		const releases = [...this.sounding.values()].map(({ command }) =>
			copyCommand(command, { type: NOTE_OFF, subtype: NOTE_OFF, velocity: 0, startAt: now })
		)
		this.reset()
		return releases
	}
	override reset(): void {
		this.held.clear()
		this.sounding.clear()
	}
	override destroy(): void {
		this.reset()
		super.destroy()
	}
}