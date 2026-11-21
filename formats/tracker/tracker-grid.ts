/**
 * Quantise a recording onto a tracker row grid
 * Shared by every module writer: tempo and speed, instruments, greedy channel allocation and patterns
 */

import type { SequenceNote } from "../note-sequence"
import { CHANNEL_DRUMS } from "./tracker-drums"
import { foldNote, planInstruments } from "./tracker-instruments"
import { framesPlayed, sampleSignature, trimToPlayed } from "./tracker-samples"
import type {
	TrackerCell,
	TrackerFormatSpec,
	TrackerInstrument,
	TrackerSample,
	TrackerSampleMap,
	TrackerSong
} from "./tracker-types"

export { CHANNEL_DRUMS, foldNote }

export const PATTERN_ROWS = 64
export const ROWS_PER_BEAT = 4
const DEFAULT_SPEED = 6

/** Seconds one tick lasts at a tracker tempo (the ProTracker / FastTracker / Impulse formula) */
export const tickSeconds = (tempo: number) => 2.5 / tempo

/** Ticks the volume envelope of an XM or IT instrument takes to fall to silence after note-off */
export const releaseTicks = (release: number, tempo: number) =>
	Math.max(2, Math.min(200, Math.round(release / tickSeconds(tempo))))

/** Speed and tempo that keep four rows per beat at `bpm`.
 * Tempo equals the BPM at speed 6; when that is outside the format's tempo range, or would round
 * badly, another speed brings the tempo back into range with the same row length.
 */
export function trackerTiming(
	bpm: number,
	limits: Pick<TrackerFormatSpec, "minTempo" | "maxTempo" | "maxSpeed">
): { speed: number; tempo: number } {
	let best: { speed: number; tempo: number; score: number } | undefined
	for (let speed = 1; speed <= limits.maxSpeed; speed++) {
		const exact = (speed * bpm) / DEFAULT_SPEED
		const tempo = Math.round(exact)
		if (tempo < limits.minTempo || tempo > limits.maxTempo) {
			continue
		}
		const score = Math.abs(tempo - exact) / exact + 0.0004 * Math.abs(speed - DEFAULT_SPEED)
		if (!best || score < best.score) {
			best = { speed, tempo, score }
		}
	}
	if (best) {
		return { speed: best.speed, tempo: best.tempo }
	}
	// No speed puts the tempo in range: stay at speed 6 and clamp, which only slows or speeds the song
	return {
		speed: DEFAULT_SPEED,
		tempo: Math.max(limits.minTempo, Math.min(limits.maxTempo, Math.round(bpm)))
	}
}

interface Allocation {
	startRow: number
	endRow: number
	instrument: number
	sample: number
	note: number
	volume: number
	channel: number
}

/** Store each one-shot only as far as the notes that play it read into it.
 * A note sounds from its row to the row where it ends; where the format releases through an envelope
 * and the grid writes a note end, the release runs on after that. Notes above a sample's base note
 * read it faster. Instruments that share a sample, however differently they are set up, share the
 * longest of their reads.
 */
function trimInstruments(
	instruments: readonly TrackerInstrument[],
	allocations: readonly Allocation[],
	cells: readonly (TrackerCell | undefined)[][],
	spec: Pick<TrackerFormatSpec, "envelopes">,
	song: Pick<TrackerSong, "tempo" | "speed">
): TrackerInstrument[] {
	const rowSeconds = song.speed * tickSeconds(song.tempo)
	const signatures = new Map<TrackerSample, string>()
	const signatureOf = (sample: TrackerSample) => {
		let signature = signatures.get(sample)
		if (signature === undefined) {
			signature = sampleSignature(sample)
			signatures.set(sample, signature)
		}
		return signature
	}
	const needed = new Map<string, number>()
	for (const allocation of allocations) {
		const instrument = instruments[allocation.instrument - 1]
		const { sample } = instrument.samples[allocation.sample]
		const released = spec.envelopes && cells[allocation.endRow][allocation.channel]?.off
		const seconds =
			(allocation.endRow - allocation.startRow) * rowSeconds +
			(released ? releaseTicks(instrument.release, song.tempo) * tickSeconds(song.tempo) : 0)
		const signature = signatureOf(sample)
		needed.set(
			signature,
			Math.max(needed.get(signature) ?? 0, framesPlayed(sample, allocation.note, seconds))
		)
	}
	const trimmed = new Map<string, TrackerSample>()
	return instruments.map((instrument) => ({
		...instrument,
		samples: instrument.samples.map((entry) => {
			const signature = signatureOf(entry.sample)
			const frames = needed.get(signature)
			if (frames === undefined) {
				return entry
			}
			let shared = trimmed.get(signature)
			if (!shared) {
				shared = trimToPlayed(entry.sample, frames)
				trimmed.set(signature, shared)
			}
			return { ...entry, sample: { ...entry.sample, data: shared.data } }
		})
	}))
}

/** Build the instruments, channels and cells for a recording */
export function buildTrackerSong(
	notes: readonly SequenceNote[],
	bpm: number,
	spec: TrackerFormatSpec,
	title: string,
	samples?: TrackerSampleMap
): TrackerSong {
	const { speed, tempo } = trackerTiming(bpm, spec)
	const rowSeconds = speed * tickSeconds(tempo)

	let plan = planInstruments(notes, spec, samples, true)
	const distinctSamples = (instruments: typeof plan.instruments) =>
		new Set(
			instruments.flatMap(({ samples: entries }) =>
				entries.map(({ sample }) => sampleSignature(sample))
			)
		).size
	const overLimit = () =>
		plan.instruments.length > spec.maxInstruments ||
		distinctSamples(plan.instruments) > spec.maxSamples
	if (overLimit() && plan.multiSample) {
		// Zones are a luxury: fall back to one sample per chain when they do not fit
		plan = planInstruments(notes, spec, samples, false)
	}
	const allocations: Allocation[] = notes.map((note, index) => {
		const startRow = Math.max(0, Math.round(note.start / rowSeconds))
		const endRow = Math.max(startRow + 1, Math.round((note.start + note.duration) / rowSeconds))
		const { instrument, sample, note: cellNote } = plan.cells[index]
		const gain = plan.instruments[instrument - 1].gain
		return {
			startRow,
			endRow,
			instrument,
			sample,
			note: cellNote,
			volume: Math.max(1, Math.min(64, Math.round((note.velocity / 127) * 64 * gain))),
			channel: -1
		}
	})
	if (!allocations.length) {
		throw new Error("Record some notes before exporting a tracker module")
	}
	if (plan.instruments.length > spec.maxInstruments) {
		throw new Error(
			`This recording uses ${plan.instruments.length} instruments but a ${spec.label} holds at most ${spec.maxInstruments}`
		)
	}
	const sampleCount = distinctSamples(plan.instruments)
	if (sampleCount > spec.maxSamples) {
		throw new Error(
			`This recording uses ${sampleCount} samples but a ${spec.label} holds at most ${spec.maxSamples}`
		)
	}

	// Greedy voice allocation: a channel is free once its last note has ended
	const sorted = allocations
		.map((allocation, index) => ({ allocation, index }))
		.sort((a, b) => a.allocation.startRow - b.allocation.startRow || a.index - b.index)
	const channelEnds: number[] = []
	const channelInstruments: number[] = []
	for (const { allocation } of sorted) {
		let chosen = -1
		for (let channel = 0; channel < channelEnds.length; channel++) {
			if (channelEnds[channel] > allocation.startRow) {
				continue
			}
			const sameInstrument = channelInstruments[channel] === allocation.instrument
			const chosenSame = chosen >= 0 && channelInstruments[chosen] === allocation.instrument
			if (chosen < 0 || (sameInstrument && !chosenSame)) {
				chosen = channel
			}
		}
		if (chosen < 0) {
			chosen = channelEnds.length
			channelEnds.push(0)
			channelInstruments.push(0)
		}
		allocation.channel = chosen
		channelEnds[chosen] = allocation.endRow
		channelInstruments[chosen] = allocation.instrument
	}
	const needed = channelEnds.length
	if (needed > spec.maxChannels) {
		throw new Error(
			`This recording plays ${needed} notes at once but a ${spec.label} has only ${spec.maxChannels} channels`
		)
	}
	const channels = Math.min(
		spec.maxChannels,
		Math.max(spec.minChannels, Math.ceil(needed / spec.channelStep) * spec.channelStep)
	)

	const rows = allocations.reduce((last, allocation) => Math.max(last, allocation.endRow), 0) + 1
	const cells: (TrackerCell | undefined)[][] = Array.from({ length: rows }, () =>
		Array.from<TrackerCell | undefined>({ length: channels })
	)
	for (const a of allocations) {
		cells[a.startRow][a.channel] = {
			off: false,
			note: a.note,
			instrument: a.instrument,
			volume: a.volume
		}
	}
	// The end of a note only needs writing when the channel is not retriggered on that row
	for (const a of allocations) {
		cells[a.endRow][a.channel] ??= { off: true }
	}
	const instruments = trimInstruments(plan.instruments, allocations, cells, spec, {
		speed,
		tempo
	})
	return { title, channels, rows, speed, tempo, instruments, cells }
}

export interface TrackerPattern {
	rows: number
	cells: (TrackerCell | undefined)[][]
}

const cellKey = (cell: TrackerCell | undefined) =>
	!cell ? "" : cell.off ? "off" : `${cell.note}/${cell.instrument}/${cell.volume}`

/** Split into patterns of 64 rows and an order list; identical patterns are stored once.
 * `fixedRows` pads the last pattern to 64 rows for formats whose patterns cannot be shorter.
 */
export function buildPatterns(
	song: TrackerSong,
	spec: Pick<TrackerFormatSpec, "label" | "maxOrders">,
	fixedRows: boolean
): { patterns: TrackerPattern[]; order: number[] } {
	const patterns: TrackerPattern[] = []
	const order: number[] = []
	const seen = new Map<string, number>()
	for (let start = 0; start < song.rows; start += PATTERN_ROWS) {
		const rows = fixedRows ? PATTERN_ROWS : Math.min(PATTERN_ROWS, song.rows - start)
		const cells = Array.from({ length: rows }, (_, row) => song.cells[start + row] ?? [])
		const signature = `${rows}|${cells.map((line) => Array.from({ length: song.channels }, (_, channel) => cellKey(line[channel])).join(",")).join(";")}`
		let index = seen.get(signature)
		if (index === undefined) {
			index = patterns.length
			patterns.push({ rows, cells })
			seen.set(signature, index)
		}
		order.push(index)
	}
	if (order.length > spec.maxOrders) {
		throw new Error(
			`This recording is too long for a ${spec.label}: it needs ${order.length} pattern slots and the format has ${spec.maxOrders}`
		)
	}
	return { patterns, order }
}