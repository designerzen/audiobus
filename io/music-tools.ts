import { mod12, pitchClasses, pitchSetMask } from "../tuning/pitch-class-set"
import {
	DEFAULT_HARMONY,
	parseHarmony,
	parseSections,
	type HarmonicState,
	type HarmonicSection
} from "./harmony"
import { NOTE_ON, NOTE_OFF } from "../commands"
import { clipCommand, parseEventClip, type EventClip } from "./event-clip"

export interface ChordStep {
	mask: number
	scale?: number
	beats: number
	root: number
	name: string
}
export interface MacroMapping {
	target: string
	minimum: number
	maximum: number
}
export interface PerformanceMacro {
	name: string
	value: number
	smoothing: number
	mappings: MacroMapping[]
}
export interface GrooveTemplate {
	name: string
	division: number
	offsets: number[]
	velocities: number[]
}
export interface MusicToolsState {
	version: 1
	harmony: HarmonicState
	sections: HarmonicSection[]
	playSections: boolean
	progression: ChordStep[]
	macros: PerformanceMacro[]
	grooves: GrooveTemplate[]
}
export const DEFAULT_CHORDS: ChordStep[] = [
	{ name: "C", root: 0, mask: 145, beats: 4 },
	{ name: "Am", root: 9, mask: 529, beats: 4 },
	{ name: "F", root: 5, mask: 545, beats: 4 },
	{ name: "G", root: 7, mask: 2180, beats: 4 }
]
export function defaultMusicTools(): MusicToolsState {
	return {
		version: 1,
		harmony: { ...DEFAULT_HARMONY },
		sections: [],
		playSections: false,
		progression: structuredClone(DEFAULT_CHORDS),
		grooves: [],
		macros: ["Density", "Harmony", "Brightness", "Variation"].map((name) => ({
			name,
			value: 0,
			smoothing: 120,
			mappings: []
		}))
	}
}
const finite = (n: unknown, low: number, high: number): n is number =>
	typeof n === "number" && Number.isFinite(n) && n >= low && n <= high
export function parseProgression(value: unknown): ChordStep[] {
	if (!Array.isArray(value) || !value.length || value.length > 128) {
		throw new Error("Choose 1–128 chords")
	}
	return value.map((step) => {
		if (
			!step ||
			!finite(step.beats, 0.25, 64) ||
			!Number.isInteger(step.root) ||
			step.root < 0 ||
			step.root > 11 ||
			typeof step.name !== "string" ||
			step.name.length > 80
		) {
			throw new Error("Invalid chord step")
		}
		return {
			mask: pitchSetMask(step.mask),
			...(step.scale === undefined ? {} : { scale: pitchSetMask(step.scale) }),
			beats: step.beats,
			root: step.root,
			name: step.name
		}
	})
}
export function parseMusicTools(value: unknown): MusicToolsState {
	if (value === undefined) {
		return defaultMusicTools()
	}
	const data = value as MusicToolsState
	if (
		!data ||
		data.version !== 1 ||
		!Array.isArray(data.macros) ||
		data.macros.length !== 4 ||
		!Array.isArray(data.grooves) ||
		data.grooves.length > 32
	) {
		throw new Error("Invalid music tools settings")
	}
	const macros = data.macros.map((macro) => {
		if (
			!macro ||
			typeof macro.name !== "string" ||
			macro.name.length > 80 ||
			!finite(macro.value, 0, 1) ||
			!finite(macro.smoothing, 0, 2000) ||
			!Array.isArray(macro.mappings) ||
			macro.mappings.length > 32
		) {
			throw new Error("Invalid performance macro")
		}
		return {
			name: macro.name,
			value: macro.value,
			smoothing: macro.smoothing,
			mappings: macro.mappings.map((mapping) => {
				if (
					!mapping ||
					typeof mapping.target !== "string" ||
					mapping.target.length > 256 ||
					!finite(mapping.minimum, -16384, 16384) ||
					!finite(mapping.maximum, -16384, 16384)
				) {
					throw new Error("Invalid macro mapping")
				}
				return {
					target: mapping.target,
					minimum: mapping.minimum,
					maximum: mapping.maximum
				}
			})
		}
	})
	return {
		version: 1,
		harmony: parseHarmony(data.harmony ?? DEFAULT_HARMONY),
		sections: parseSections(data.sections ?? []),
		playSections: data.playSections === true,
		progression: parseProgression(data.progression),
		macros,
		grooves: data.grooves.map(parseGroove)
	}
}
export function chordAt(progression: ChordStep[], beat: number): ChordStep {
	const length = progression.reduce((sum, step) => sum + step.beats, 0)
	let position = ((beat % length) + length) % length
	for (const step of progression) {
		if (position < step.beats) {
			return step
		}
		position -= step.beats
	}
	return progression[0]
}
export function macroValue(mapping: MacroMapping, value: number): number {
	return mapping.minimum + (mapping.maximum - mapping.minimum) * Math.max(0, Math.min(1, value))
}
export function parseGroove(value: unknown): GrooveTemplate {
	const groove = value as GrooveTemplate
	if (
		!groove ||
		typeof groove.name !== "string" ||
		groove.name.length > 80 ||
		!finite(groove.division, 0.125, 1) ||
		!Array.isArray(groove.offsets) ||
		!groove.offsets.length ||
		groove.offsets.length > 128 ||
		!Array.isArray(groove.velocities) ||
		groove.velocities.length !== groove.offsets.length ||
		groove.offsets.some((n) => !finite(n, -groove.division / 2, groove.division / 2)) ||
		groove.velocities.some((n) => !finite(n, 1, 127))
	) {
		throw new Error("Invalid groove template")
	}
	return {
		name: groove.name,
		division: groove.division,
		offsets: [...groove.offsets],
		velocities: [...groove.velocities]
	}
}
/** Timing is stored in beats so a template survives tempo changes. */
export function captureGroove(
	clip: EventClip,
	bpm: number,
	division = 0.25,
	name = "My groove"
): GrooveTemplate {
	if (!finite(bpm, 20, 400) || !finite(division, 0.125, 1)) {
		throw new Error("Invalid groove tempo or grid")
	}
	const stepSeconds = (division * 60) / bpm
	const count = Math.max(1, Math.min(128, Math.round(clip.duration / stepSeconds)))
	const buckets: { offset: number; velocity: number }[][] = Array.from(
		{ length: count },
		() => []
	)
	for (const command of clip.commands) {
		if (command.type === NOTE_ON && command.velocity > 0) {
			const index = Math.round(command.startAt / stepSeconds)
			buckets[index % count].push({
				offset: (command.startAt * bpm) / 60 - index * division,
				velocity: command.velocity
			})
		}
	}
	if (!buckets.some((bucket) => bucket.length)) {
		throw new Error("Play some notes before capturing a groove")
	}
	return parseGroove({
		name,
		division,
		offsets: buckets.map((bucket) =>
			bucket.length ? bucket.reduce((sum, n) => sum + n.offset, 0) / bucket.length : 0
		),
		velocities: buckets.map((bucket) =>
			bucket.length ? bucket.reduce((sum, n) => sum + n.velocity, 0) / bucket.length : 80
		)
	})
}
export function applyGroove(
	clip: EventClip,
	groove: GrooveTemplate,
	bpm: number,
	timing: number,
	dynamics: number
): EventClip {
	parseGroove(groove)
	if (!finite(bpm, 20, 400) || !finite(timing, 0, 1) || !finite(dynamics, 0, 1)) {
		throw new Error("Invalid groove strength")
	}
	if (timing === 0 && dynamics === 0) {
		return parseEventClip(clip)
	}
	const held = new Map<string, { shift: number; start: number }[]>()
	const commands = clip.commands.map((source) => {
		const command = clipCommand(source)
		const key = `${source.from}:${source.channel}:${source.number}`
		if (source.type === NOTE_ON && source.velocity > 0) {
			const grid = Math.round((source.startAt * bpm) / 60 / groove.division)
			const slot = grid % groove.offsets.length
			const target = ((grid * groove.division + groove.offsets[slot]) * 60) / bpm
			const start =
				timing === 0
					? source.startAt
					: Math.max(
							0,
							Math.min(
								clip.duration - 0.001,
								source.startAt + (target - source.startAt) * timing
							)
						)
			const queue = held.get(key) ?? []
			queue.push({ shift: start - source.startAt, start })
			held.set(key, queue)
			command.startAt = start
			command.velocity =
				dynamics === 0
					? source.velocity
					: Math.round(
							source.velocity + (groove.velocities[slot] - source.velocity) * dynamics
						)
		} else if (source.type === NOTE_OFF || source.type === NOTE_ON) {
			const note = held.get(key)?.shift()
			if (note) {
				command.startAt = Math.min(
					clip.duration,
					Math.max(note.start + 0.001, source.startAt + note.shift)
				)
			}
		}
		command.time = command.startAt
		return command
	})
	return parseEventClip({ ...clip, commands })
}
export interface HarmonicRoute {
	masks: number[]
	cost: number
	explanations: string[]
}
/** Short, monotone routes: every step resolves at least one difference from the destination. */
export function harmonicRoutes(start: number, destination: number): HarmonicRoute[] {
	start = pitchSetMask(start)
	destination = pitchSetMask(destination)
	if (!start || !destination) {
		throw new Error("Choose nonempty pitch sets for a musical route")
	}
	const results = [0, 1, 2].map((strategy) => {
		const masks = [start]
		let current = start
		let cost = 0
		const explanations: string[] = []
		while (current !== destination) {
			const remove = pitchClasses(current & ~destination),
				add = pitchClasses(destination & ~current)
			const choices: { mask: number; cost: number; text: string }[] = []
			for (const a of remove) {
				for (const b of add) {
					const distance = Math.min(mod12(a - b), mod12(b - a))
					choices.push({
						mask: (current & ~(1 << a)) | (1 << b),
						cost: distance + (strategy === 1 ? 3 : 0),
						text: `Move ${a} to ${b} (${distance} semitones); keep ${pitchClasses(current).length - 1} common tones.`
					})
				}
			}
			for (const b of add) {
				choices.push({
					mask: current | (1 << b),
					cost: strategy === 1 ? 1 : 4 + strategy,
					text: `Add pitch class ${b}; keep all existing tones.`
				})
			}
			for (const a of remove) {
				if (current !== 1 << a) {
					choices.push({
						mask: current & ~(1 << a),
						cost: strategy === 2 ? 1 : 4,
						text: `Remove pitch class ${a}; retain the other tones.`
					})
				}
			}
			choices.sort((a, b) => a.cost - b.cost || a.mask - b.mask)
			const chosen = choices[0]
			current = chosen.mask
			cost += chosen.cost
			masks.push(current)
			explanations.push(chosen.text)
		}
		return { masks, cost, explanations }
	})
	return results.filter(
		(route, index) =>
			results.findIndex((other) => other.masks.join() === route.masks.join()) === index
	)
}