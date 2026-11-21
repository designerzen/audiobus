/**
 * Quantise a recording onto a tracker row grid
 * Shared by every module writer: tempo and speed, instruments, greedy channel allocation and patterns
 */

import type { SequenceNote } from "../note-sequence"
import { prepareSample } from "./tracker-samples"
import { synthesiseTrackerSample } from "./tracker-timbres"
import {
	trackerInstrumentKey,
	type TrackerCell,
	type TrackerFormatSpec,
	type TrackerInstrument,
	type TrackerSampleMap,
	type TrackerSong
} from "./tracker-types"

export const PATTERN_ROWS = 64
export const ROWS_PER_BEAT = 4
const DEFAULT_SPEED = 6
export const CHANNEL_DRUMS = 10

/** Seconds one tick lasts at a tracker tempo (the ProTracker / FastTracker / Impulse formula) */
export const tickSeconds = (tempo: number) => 2.5 / tempo

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

interface Allocation {
	startRow: number
	endRow: number
	instrument: number
	note: number
	volume: number
	channel: number
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

	const instruments: TrackerInstrument[] = []
	const instrumentIds = new Map<string, number>()
	const instrumentFor = (note: SequenceNote, cellNote: number) => {
		const key = trackerInstrumentKey(note)
		const supplied = samples?.get(key)
		// Without a captured timbre each drum key gets its own synthesised sound, played at its key
		const fixedPitch = note.channel === CHANNEL_DRUMS && !supplied
		const id = fixedPitch ? `${key}|${note.number}` : key
		const existing = instrumentIds.get(id)
		if (existing !== undefined) {
			return existing
		}
		const source =
			supplied ??
			synthesiseTrackerSample({
				channel: note.channel,
				patch: note.patch,
				number: note.number
			})
		const prepared = prepareSample(fixedPitch ? { ...source, baseNote: cellNote } : source)
		instruments.push({
			name: source.name,
			sample: prepared.sample,
			gain: prepared.gain,
			release: fixedPitch ? 0.12 : prepared.sample.loopLength === undefined ? 0.35 : 0.18
		})
		instrumentIds.set(id, instruments.length)
		return instruments.length
	}

	const allocations: Allocation[] = notes.map((note) => {
		const startRow = Math.max(0, Math.round(note.start / rowSeconds))
		const endRow = Math.max(startRow + 1, Math.round((note.start + note.duration) / rowSeconds))
		const cellNote = foldNote(note.number, spec.noteRange)
		const instrument = instrumentFor(note, cellNote)
		const gain = instruments[instrument - 1].gain
		return {
			startRow,
			endRow,
			instrument,
			note: cellNote,
			volume: Math.max(1, Math.min(64, Math.round((note.velocity / 127) * 64 * gain))),
			channel: -1
		}
	})
	if (!allocations.length) {
		throw new Error("Record some notes before exporting a tracker module")
	}
	if (instruments.length > spec.maxInstruments) {
		throw new Error(
			`This recording uses ${instruments.length} instruments but a ${spec.label} holds at most ${spec.maxInstruments}`
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