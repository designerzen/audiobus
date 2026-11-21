/**
 * Instruments for a tracker module: which sample plays each note
 * Pitched chains share one sample across their notes, or one per zone for a wide range; a drum chain
 * is a kit that holds one sample per drum voice. Instruments that would sound the same are stored once.
 */

import type { SequenceNote } from "../note-sequence"
import { CHANNEL_DRUMS, drumVoiceOf } from "./tracker-drums"
import { prepareSample, sampleSignature, scaleSample, type PreparedSample } from "./tracker-samples"
import { synthesiseTrackerSample } from "./tracker-timbres"
import {
	isTrackerSampleSet,
	trackerInstrumentKey,
	type TrackerFormatSpec,
	type TrackerInstrument,
	type TrackerSample,
	type TrackerSampleMap,
	type TrackerSampleSet
} from "./tracker-types"

const DRUM_RELEASE = 0.12
const LOOPED_RELEASE = 0.18
const ONE_SHOT_RELEASE = 0.35

/** Octave-fold a MIDI note into a format's playable range, keeping its pitch class */
export function foldNote(note: number, [low, high]: readonly [number, number]) {
	let folded = note
	while (folded > high) {
		folded -= 12
	}
	while (folded < low) {
		folded += 12
	}
	return folded
}

/** Fold into a range that may be narrower than an octave, where the nearest in-range value stands in */
function foldInto(value: number, low: number, high: number) {
	if (high - low < 11) {
		return Math.max(low, Math.min(high, value))
	}
	return foldNote(value, [low, high])
}

/** An instrument before identical ones are merged */
interface Draft {
	name: string
	samples: { sample: TrackerSample; gain: number }[]
	keymap: Map<number, number>
	gain: number
	release: number
}

interface Placement {
	draft: Draft
	sample: number
	cell: number
}

/** Where each note plays: a 1-based instrument, the index of its sample and the cell note that sounds it */
export interface InstrumentPlan {
	instruments: TrackerInstrument[]
	cells: { instrument: number; sample: number; note: number }[]
	/** Whether any chain was voiced by more than one sample */
	multiSample: boolean
}

const draftSignature = (draft: Draft) =>
	[
		draft.release,
		Math.round(draft.gain * 1e6),
		[...draft.keymap]
			.sort((a, b) => a[0] - b[0])
			.map(([note, index]) => `${note}>${index}`)
			.join(","),
		draft.samples.map(({ sample }) => sampleSignature(sample)).join("|")
	].join("/")

/** Index of the sample, from `candidates` sorted by pitch, whose base note is nearest `note` */
function nearestSample(candidates: readonly TrackerSample[], note: number) {
	let best = 0
	for (let i = 1; i < candidates.length; i++) {
		if (Math.abs(candidates[i].baseNote - note) < Math.abs(candidates[best].baseNote - note)) {
			best = i
		}
	}
	return best
}

/** Spread `count` picks evenly over a list, keeping its ends */
const thin = <T>(items: readonly T[], count: number): T[] =>
	count >= items.length
		? [...items]
		: Array.from(
				{ length: count },
				(_, i) =>
					items[
						count === 1
							? items.length >> 1
							: Math.round((i * (items.length - 1)) / (count - 1))
					]
			)

/** Plan the instruments for a list of notes. With `zones` off, a chain with several captured samples
 * uses only the one nearest its median note.
 */
export function planInstruments(
	notes: readonly SequenceNote[],
	spec: TrackerFormatSpec,
	samples: TrackerSampleMap | undefined,
	zones: boolean
): InstrumentPlan {
	const [low, high] = spec.noteRange
	const prepared = new Map<TrackerSample, PreparedSample>()
	const prepare = (sample: TrackerSample) => {
		let result = prepared.get(sample)
		if (!result) {
			result = prepareSample(sample)
			prepared.set(sample, result)
		}
		return result
	}
	const synthesised = new Map<string, TrackerSample>()
	const synthesise = (channel: number, patch: number, number?: number) => {
		const key = channel === CHANNEL_DRUMS ? `drum-${number}` : `patch-${patch}`
		let result = synthesised.get(key)
		if (!result) {
			result = synthesiseTrackerSample({ channel, patch, number })
			synthesised.set(key, result)
		}
		return result
	}
	/** Merge samples into one draft, keeping their loudness relative to each other */
	const draftOf = (
		name: string,
		members: readonly { sample: TrackerSample; label?: number }[],
		release: number | undefined
	): Draft => {
		const levels = members.map(({ sample }) => prepare(sample))
		const gain = Math.max(...levels.map((level) => level.gain))
		return {
			name,
			samples: members.map(({ label }, i) => {
				const { sample } = levels[i]
				const scaled = scaleSample(sample, gain > 0 ? levels[i].gain / gain : 1)
				return {
					sample: label === undefined ? scaled : { ...scaled, baseNote: label },
					gain: levels[i].gain
				}
			}),
			keymap: new Map(),
			gain,
			release:
				release ??
				(levels[0].sample.loopLength === undefined ? ONE_SHOT_RELEASE : LOOPED_RELEASE)
		}
	}

	const groups = new Map<string, number[]>()
	notes.forEach((note, index) => {
		const key = trackerInstrumentKey(note)
		groups.set(key, [...(groups.get(key) ?? []), index])
	})
	const placements = new Array<Placement>(notes.length)
	let multiSample = false

	const planPitched = (key: string, indices: number[]) => {
		const supplied = samples?.get(key)
		const set: TrackerSampleSet | undefined = supplied
			? isTrackerSampleSet(supplied)
				? supplied
				: { samples: [supplied] }
			: undefined
		const source = set?.samples.length
			? set.samples
			: [synthesise(notes[indices[0]].channel, notes[indices[0]].patch)]
		const cells = indices.map((index) => foldNote(notes[index].number, spec.noteRange))
		let candidates = [...source].sort((a, b) => a.baseNote - b.baseNote)
		if (!zones && candidates.length > 1) {
			const median = [...cells].sort((a, b) => a - b)[(cells.length - 1) >> 1]
			candidates = [candidates[nearestSample(candidates, median)]]
		}
		if (spec.keymaps) {
			candidates = thin(candidates, spec.maxInstrumentSamples)
		}
		const pick = (index: number, cell: number) => {
			const explicit = set?.keymap?.get(notes[index].number)
			const chosen = explicit === undefined ? undefined : set?.samples[explicit]
			const at = chosen ? candidates.indexOf(chosen) : -1
			return at >= 0 ? at : nearestSample(candidates, cell)
		}
		const zoneOf = indices.map((index, n) => pick(index, cells[n]))
		const used = [...new Set(zoneOf)].sort((a, b) => a - b)
		multiSample ||= used.length > 1
		if (spec.keymaps) {
			const draft = draftOf(
				candidates[used[0]].name,
				used.map((zone) => ({ sample: candidates[zone] })),
				undefined
			)
			if (used.length > 1) {
				indices.forEach((_, n) => {
					if (!draft.keymap.has(cells[n])) {
						draft.keymap.set(cells[n], used.indexOf(zoneOf[n]))
					}
				})
			}
			indices.forEach((index, n) => {
				placements[index] = {
					draft,
					sample: used.length > 1 ? draft.keymap.get(cells[n])! : 0,
					cell: cells[n]
				}
			})
			return
		}
		const drafts = new Map(
			used.map(
				(zone) =>
					[
						zone,
						draftOf(candidates[zone].name, [{ sample: candidates[zone] }], undefined)
					] as const
			)
		)
		indices.forEach((index, n) => {
			placements[index] = { draft: drafts.get(zoneOf[n])!, sample: 0, cell: cells[n] }
		})
	}

	interface Source {
		sample: TrackerSample
		rep: number
		pitched: boolean
		keys: Set<number>
	}
	const planDrums = (key: string, indices: number[]) => {
		const supplied = samples?.get(key)
		const set: TrackerSampleSet | undefined = supplied
			? isTrackerSampleSet(supplied)
				? supplied
				: { samples: [supplied] }
			: undefined
		const capturedFor = (number: number) => {
			if (!set) {
				return undefined
			}
			const explicit = set.keymap?.get(number)
			if (explicit !== undefined && set.samples[explicit]) {
				return explicit
			}
			const voice = drumVoiceOf(number).id
			const found = set.samples.findIndex(
				(sample) => drumVoiceOf(sample.baseNote).id === voice
			)
			return found >= 0 ? found : undefined
		}
		const sources = new Map<string, Source>()
		const sourceOf = indices.map((index) => {
			const number = notes[index].number
			const voice = drumVoiceOf(number)
			const captured = capturedFor(number)
			const id = captured === undefined ? `voice-${voice.id}` : `captured-${captured}`
			let source = sources.get(id)
			if (!source) {
				const sample =
					captured === undefined
						? synthesise(CHANNEL_DRUMS, 0, voice.rep)
						: set!.samples[captured]
				source = { sample, rep: sample.baseNote, pitched: voice.pitched, keys: new Set() }
				sources.set(id, source)
			}
			source.keys.add(number)
			return source
		})
		const offset = (source: Source, number: number) =>
			source.pitched ? number - source.rep : 0
		const span = (source: Source) => {
			const offsets = [...source.keys].map((number) => offset(source, number))
			return [Math.min(...offsets), Math.max(...offsets)] as const
		}

		// Label each sample with the note that plays it unshifted. Without a keymap every sample has an
		// instrument of its own; with one, the notes a sample answers to cannot overlap another's.
		const labels = new Map<Source, number>()
		const claimed = new Set<number>()
		const ordered = [...sources.values()]
		const placing = [...ordered].sort((a, b) => {
			const [aLow, aHigh] = span(a)
			const [bLow, bHigh] = span(b)
			const aWidth = aHigh - aLow
			const bWidth = bHigh - bLow
			return (
				(aWidth === 0 ? 0 : 1) - (bWidth === 0 ? 0 : 1) || bWidth - aWidth || a.rep - b.rep
			)
		})
		for (const source of placing) {
			const [from, to] = span(source)
			const lowest = low - from
			const highest = high - to
			const preferred = foldInto(source.rep, lowest, highest)
			let label = preferred
			if (spec.keymaps) {
				const free = (candidate: number) => {
					if (candidate < lowest || candidate > highest) {
						return false
					}
					for (let cell = candidate + from; cell <= candidate + to; cell++) {
						if (claimed.has(cell)) {
							return false
						}
					}
					return true
				}
				for (let step = 0; step <= high - low; step++) {
					const found = [preferred + step, preferred - step].find(free)
					if (found !== undefined) {
						label = found
						break
					}
				}
				for (let cell = label + from; cell <= label + to; cell++) {
					claimed.add(cell)
				}
			}
			labels.set(source, label)
		}

		const perDraft = spec.keymaps ? spec.maxInstrumentSamples : 1
		const draftOfSource = new Map<Source, { draft: Draft; index: number }>()
		for (let start = 0; start < ordered.length; start += perDraft) {
			const members = ordered.slice(start, start + perDraft)
			const draft = draftOf(
				members.length > 1 ? "Drum kit" : members[0].sample.name,
				members.map((source) => ({ sample: source.sample, label: labels.get(source) })),
				DRUM_RELEASE
			)
			members.forEach((source, index) => {
				draftOfSource.set(source, { draft, index })
				if (members.length > 1) {
					for (const number of source.keys) {
						draft.keymap.set(labels.get(source)! + offset(source, number), index)
					}
				}
			})
		}
		indices.forEach((index, n) => {
			const source = sourceOf[n]
			const { draft, index: sample } = draftOfSource.get(source)!
			placements[index] = {
				draft,
				sample,
				cell: labels.get(source)! + offset(source, notes[index].number)
			}
		})
	}

	for (const [key, indices] of groups) {
		if (notes[indices[0]].channel === CHANNEL_DRUMS) {
			planDrums(key, indices)
		} else {
			planPitched(key, indices)
		}
	}

	const instruments: TrackerInstrument[] = []
	const byDraft = new Map<Draft, number>()
	const bySignature = new Map<string, number>()
	const cells = placements.map(({ draft, sample, cell }) => {
		let id = byDraft.get(draft)
		if (id === undefined) {
			const signature = draftSignature(draft)
			id = bySignature.get(signature)
			if (id === undefined) {
				instruments.push({
					name: draft.name,
					samples: draft.samples.map(({ sample }) => ({
						sample,
						lowest: Infinity,
						highest: -Infinity
					})),
					keymap: draft.keymap,
					gain: draft.gain,
					release: draft.release
				})
				id = instruments.length
				bySignature.set(signature, id)
			}
			byDraft.set(draft, id)
		}
		const entry = instruments[id - 1].samples[sample]
		entry.lowest = Math.min(entry.lowest, cell)
		entry.highest = Math.max(entry.highest, cell)
		return { instrument: id, sample, note: cell }
	})
	return { instruments, cells, multiSample }
}

/** For each note from `low` to `high`, the index of the sample of an instrument that plays it.
 * Notes the keymap leaves out use the nearest mapped note's sample.
 */
export function sampleIndexTable(
	instrument: TrackerInstrument,
	[low, high]: readonly [number, number]
): number[] {
	const mapped = [...instrument.keymap.keys()].sort((a, b) => a - b)
	return Array.from({ length: high - low + 1 }, (_, i) => {
		if (!mapped.length) {
			return 0
		}
		const note = low + i
		let best = mapped[0]
		for (const candidate of mapped) {
			if (Math.abs(candidate - note) < Math.abs(best - note)) {
				best = candidate
			}
		}
		return instrument.keymap.get(best)!
	})
}