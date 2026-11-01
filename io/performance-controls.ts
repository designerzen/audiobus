import {
	createGuitarTabControl,
	createPianoRollControl,
	createRelativeKeysControl,
	musicOptions,
	createStrumControl,
	strumOptions
} from "control-surface"
import { bindingKey, validateValue } from "control-surface/model"
import type { ControlBinding, ControlValue } from "control-surface/types"

interface NoteSource {
	noteOn?(note: number, velocity: number): unknown
	noteOff?(note: number): void
}
interface PerformanceState {
	values: Map<string, number[]>
	notes: Map<string, Map<number, number>>
	listeners: Set<() => void>
	plucks: Map<number, { note: number; velocity: number; timer?: ReturnType<typeof setTimeout> }>
	queue?: Promise<void>
}
const states = new WeakMap<object, PerformanceState>()

/** Live note controls are offered by every note-capable output, alongside its parameters. */
export function performanceBindings(
	component: NoteSource,
	componentId: string,
	sourceLabel: string
): ControlBinding[] {
	if (!component.noteOn || !component.noteOff) {
		return []
	}
	let state = states.get(component)
	if (!state) {
		state = { values: new Map(), notes: new Map(), listeners: new Set(), plucks: new Map() }
		states.set(component, state)
	}
	const shared = state
	const descriptors = [
		createRelativeKeysControl({
			id: "surface:relative-keys",
			label: "Relative keys",
			group: "Performance",
			help: "The first finger anchors the root; other fingers play relative intervals."
		}),
		createPianoRollControl({
			id: "surface:piano-roll",
			label: "Piano roll",
			group: "Performance",
			music: { live: true },
			help: "Live note grid: toggle cells to hold notes; toggle them off to release. This grid does not run a transport."
		}),
		createGuitarTabControl({
			id: "surface:guitar-tab",
			label: "Guitar tab",
			group: "Performance",
			music: { live: true },
			help: "Live tablature: edit frets to hold notes, or clear cells to release them."
		}),
		createStrumControl({
			id: "surface:strum",
			label: "Strum",
			group: "Performance",
			help: "Swipe across the strings to strum; pressure controls velocity. Notes ring briefly, then release automatically."
		})
	]
	return descriptors.map((descriptor) => ({
		key: bindingKey(componentId, descriptor.id),
		sourceId: componentId,
		sourceLabel,
		descriptor,
		read: () => shared.values.get(descriptor.id) ?? descriptor.defaultValue,
		write(value: ControlValue) {
			const run = async () => {
				const values = validateValue(descriptor, value) as number[]
				const voices = new Map<number, number>()
				let pluck:
					| { note: number; velocity: number; timer?: ReturnType<typeof setTimeout> }
					| undefined
				if (descriptor.widget === "strum") {
					if (!values.length) {
						for (const held of shared.plucks.values()) {
							clearTimeout(held.timer)
						}
						shared.plucks.clear()
					} else {
						clearTimeout(shared.plucks.get(values[1])?.timer)
						pluck = { note: values[2], velocity: values[3] }
						shared.plucks.set(values[1], pluck)
					}
					for (const held of shared.plucks.values()) {
						voices.set(held.note, Math.max(voices.get(held.note) ?? 0, held.velocity))
					}
				} else if (descriptor.widget === "relative-keys") {
					for (let i = 2; i < values.length; i += 5) {
						voices.set(
							values[i + 1],
							Math.max(voices.get(values[i + 1]) ?? 0, values[i + 2])
						)
					}
				} else {
					const { steps, pitches } = musicOptions(descriptor.widget, descriptor.music)
					values.forEach((cell, i) => {
						const tab = descriptor.widget === "guitar-tab",
							pitch = pitches[Math.floor(i / steps)]
						if (tab ? cell >= 0 : cell > 0) {
							const note = Math.min(127, pitch + (tab ? cell : 0))
							voices.set(note, Math.max(voices.get(note) ?? 0, tab ? 0.8 : cell))
						}
					})
				}
				const union = () => {
					const all = new Map<number, number>()
					for (const source of shared.notes.values()) {
						for (const [note, velocity] of source) {
							all.set(note, Math.max(all.get(note) ?? 0, velocity))
						}
					}
					return all
				}
				const previous = union()
				shared.values.set(descriptor.id, values)
				shared.notes.set(descriptor.id, voices)
				const next = union()
				for (const note of previous.keys()) {
					if (!next.has(note)) {
						component.noteOff!(note)
					}
				}
				try {
					for (const [note, velocity] of next) {
						if (!previous.has(note) || pluck?.note === note) {
							if (previous.has(note) && pluck?.note === note) {
								component.noteOff!(note)
							}
							await component.noteOn!(note, Math.max(1, Math.round(velocity * 127)))
						}
					}
				} catch (error) {
					shared.notes.delete(descriptor.id)
					shared.values.delete(descriptor.id)
					if (descriptor.widget === "strum") {
						for (const held of shared.plucks.values()) {
							clearTimeout(held.timer)
						}
						shared.plucks.clear()
					}
					for (const note of voices.keys()) {
						if (!Array.from(shared.notes.values()).some((notes) => notes.has(note))) {
							component.noteOff!(note)
						}
					}
					throw error
				}
				if (pluck) {
					const current = pluck,
						row = values[1]
					current.timer = setTimeout(() => {
						if (shared.plucks.get(row) !== current) {
							return
						}
						shared.plucks.delete(row)
						const remaining = new Map<number, number>()
						for (const held of shared.plucks.values()) {
							remaining.set(
								held.note,
								Math.max(remaining.get(held.note) ?? 0, held.velocity)
							)
						}
						shared.notes.set(descriptor.id, remaining)
						if (
							!Array.from(shared.notes.values()).some((notes) =>
								notes.has(current.note)
							)
						) {
							component.noteOff!(current.note)
						}
					}, strumOptions(descriptor.strum).duration)
				}
				shared.listeners.forEach((listener) => listener())
			}
			const result = shared.queue ? shared.queue.then(run, run) : run()
			shared.queue = result
			const clear = () => {
				if (shared.queue === result) {
					shared.queue = undefined
				}
			}
			void result.then(clear, clear)
			return result
		},
		subscribe(listener: () => void) {
			shared.listeners.add(listener)
			return () => shared.listeners.delete(listener)
		}
	}))
}