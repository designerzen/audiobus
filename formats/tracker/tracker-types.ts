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

/** Timbres keyed by trackerInstrumentKey */
export type TrackerSampleMap = ReadonlyMap<string, TrackerSample>

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

/** An instrument as it appears in a module: a prepared sample plus how loudly cells should trigger it */
export interface TrackerInstrument {
	name: string
	/** Peak-normalised and length-capped; baseNote is the pitch at which it plays unshifted */
	sample: TrackerSample
	/** 0..1 multiplier applied to cell volumes, from the sample's volume and its original level */
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