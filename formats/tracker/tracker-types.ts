/**
 * Shared types for tracker module export
 * Samples are captured from the instruments that played a recording, or synthesised as a fallback
 */

import type { SequenceNote } from "../note-sequence"

/** Mono sample with the pitch it plays at its natural rate */
export interface TrackerSample {
	name: string
	/** Mono PCM in -1..1 */
	data: Float32Array
	sampleRate: number
	/** MIDI note that sounds when the sample plays back at sampleRate */
	baseNote: number
	/** Loop region in frames; omit both for a one-shot sample */
	loopStart?: number
	loopLength?: number
	/** 0..1 */
	volume?: number
}

/** Several samples that together voice one instrument key.
 * A drum chain holds one sample per drum voice, each with the drum key it was played at as its
 * baseNote; a wide-range pitched instrument holds one sample per zone.
 */
export interface TrackerSampleSet {
	samples: TrackerSample[]
	/** MIDI note to the index of the sample that voices it. A drum key without an entry uses the
	 * sample of its drum voice, or a synthesised one; a pitched note without an entry uses the
	 * sample whose baseNote is nearest.
	 */
	keymap?: ReadonlyMap<number, number>
}

/** Timbres keyed by trackerInstrumentKey; a plain sample plays the whole instrument */
export type TrackerSampleMap = ReadonlyMap<string, TrackerSample | TrackerSampleSet>

export const isTrackerSampleSet = (
	value: TrackerSample | TrackerSampleSet
): value is TrackerSampleSet => "samples" in value

export const TRACKER_EXPORT_FORMATS = [
	{ id: "med", label: "OctaMED module", extension: "med" },
	{ id: "mod", label: "ProTracker module", extension: "mod" },
	{ id: "xm", label: "FastTracker 2 module", extension: "xm" },
	{ id: "s3m", label: "Scream Tracker 3 module", extension: "s3m" },
	{ id: "it", label: "Impulse Tracker module", extension: "it" }
] as const
export type TrackerExportId = (typeof TRACKER_EXPORT_FORMATS)[number]["id"]

export interface TrackerExportOptions {
	/** Captured instrument timbres; missing instruments use a synthesised General MIDI approximation */
	samples?: TrackerSampleMap
}

/** One sample of an instrument and the cell notes that play it */
export interface TrackerInstrumentSample {
	/** Peak-normalised, length-capped and tail-trimmed; baseNote is the pitch at which it plays unshifted.
	 * An instrument with several samples carries their relative levels in the data.
	 */
	sample: TrackerSample
	/** Lowest and highest cell note that plays it */
	lowest: number
	highest: number
}

/** An instrument as it appears in a module: prepared samples plus how loudly cells should trigger it */
export interface TrackerInstrument {
	name: string
	/** Always one for formats without a keymap */
	samples: TrackerInstrumentSample[]
	/** Cell note to the index of the sample that plays it; empty when there is a single sample */
	keymap: ReadonlyMap<number, number>
	/** 0..1 multiplier applied to cell volumes, from the loudest sample's volume and its original level */
	gain: number
	/** Seconds the sound takes to die after note-off, for formats with envelopes */
	release: number
}

/** A note start at MIDI pitch, or the end of whatever the channel was playing */
export type TrackerCell =
	| { off: false; note: number; instrument: number; volume: number }
	| { off: true }

/** Quantised recording ready for a format writer; cells[row][channel] */
export interface TrackerSong {
	title: string
	channels: number
	rows: number
	speed: number
	tempo: number
	instruments: TrackerInstrument[]
	cells: (TrackerCell | undefined)[][]
}

/** What the grid builder needs to know about a format */
export interface TrackerFormatSpec {
	id: TrackerExportId
	label: string
	minChannels: number
	maxChannels: number
	/** Channel counts are rounded up to a multiple of this */
	channelStep: number
	maxInstruments: number
	/** Whether an instrument maps each note to one of its samples */
	keymaps: boolean
	/** Whether a note end releases through the instrument's envelope; otherwise the note is cut at once */
	envelopes: boolean
	/** Samples an instrument holds; one without a keymap */
	maxInstrumentSamples: number
	/** Distinct samples a module holds */
	maxSamples: number
	maxOrders: number
	/** Lowest and highest MIDI note the format can play; others are octave-folded into this range */
	noteRange: readonly [number, number]
	minTempo: number
	maxTempo: number
	maxSpeed: number
}

/** One tracker instrument per chain, channel and program, so each instrument keeps its own timbre */
export const trackerInstrumentKey = (
	note: Pick<SequenceNote, "chainId" | "channel" | "patch">
): string => JSON.stringify([note.chainId ?? "", note.channel, note.patch])