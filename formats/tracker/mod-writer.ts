/** ProTracker module (.mod) writer: 8-bit samples, three octaves, volume and cut through Cxx */

import { ByteWriter, trackerName } from "./tracker-bytes"
import { buildPatterns } from "./tracker-grid"
import { evenLoop, resampleSample, toInt8 } from "./tracker-samples"
import type { TrackerFormatSpec, TrackerSong } from "./tracker-types"

/** The lowest MIDI note ProTracker's first period (C-1, 856) plays; its 36 notes span three octaves.
 * Notes outside MIDI 48..83 are octave-folded into that window, which keeps the pitch class and
 * changes only the register. libopenmpt reports period 428 as MIDI 60, which plays a sample at
 * its stored rate (8287 Hz on a PAL Amiga).
 */
export const MOD_LOW_NOTE = 48

export const MOD_SPEC: TrackerFormatSpec = {
	id: "mod",
	label: "ProTracker module",
	minChannels: 4,
	maxChannels: 32,
	channelStep: 2,
	maxInstruments: 31,
	keymaps: false,
	envelopes: false,
	maxInstrumentSamples: 1,
	maxSamples: 31,
	maxOrders: 128,
	noteRange: [MOD_LOW_NOTE, MOD_LOW_NOTE + 35],
	minTempo: 32,
	maxTempo: 255,
	maxSpeed: 31
}

/** Finetune-0 periods for C-1 to B-3 */
const PERIODS = [
	856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, 428, 404, 381, 360, 339, 320, 302,
	285, 269, 254, 240, 226, 214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113
]
/** Playback rate for the first period (856) on a PAL Amiga: 3546895 Hz / period, as libopenmpt does */
const MOD_BASE_RATE = 3546894.6 / 856
/** Finetune is a signed nibble in eighths of a semitone. Every sample is tuned to its lowest value, one
 * semitone down, which slows playback and so lets the stored sample carry 5.6% fewer frames for the
 * same sound; the cell notes and so the note numbers read back are unchanged.
 */
const MOD_FINETUNE = -8
const MAX_SAMPLE_BYTES = 131070
const DEFAULT_SPEED = 6
const DEFAULT_TEMPO = 125

const tag = (channels: number) =>
	channels === 4 ? "M.K." : channels < 10 ? `${channels}CHN` : `${channels}CH`

export function writeMOD(source: TrackerSong): Uint8Array<ArrayBuffer> {
	// Speed and tempo have no header field in a MOD: they are Fxx effects on the first row.
	// Each needs a cell without an effect; when the first row has none to spare, the song starts
	// one row later so a row of its own can carry them.
	const timing: number[] = []
	if (source.tempo !== DEFAULT_TEMPO) {
		timing.push(source.tempo)
	}
	if (source.speed !== DEFAULT_SPEED) {
		timing.push(source.speed)
	}
	const first = source.cells[0] ?? []
	const spare = Array.from({ length: source.channels }, (_, channel) => channel).filter(
		(channel) => !first[channel]
	)
	const leadIn = spare.length < timing.length
	const song: TrackerSong = leadIn
		? { ...source, rows: source.rows + 1, cells: [[], ...source.cells] }
		: source
	const free = leadIn ? Array.from({ length: song.channels }, (_, channel) => channel) : spare
	const channels = song.channels
	const { patterns, order } = buildPatterns(song, MOD_SPEC, true)

	const stored = song.instruments.map(({ samples }) => {
		const { sample } = samples[0]
		// Pitch comes from the period and finetune alone, so the stored rate is the rate the base note plays at
		const rate = MOD_BASE_RATE * 2 ** ((sample.baseNote - MOD_LOW_NOTE + MOD_FINETUNE / 8) / 12)
		// The rate is held exactly and the loop is rounded instead
		const resampled = evenLoop(resampleSample(sample, rate, true))
		return resampled.data.length > MAX_SAMPLE_BYTES
			? {
					...resampled,
					data: resampled.data.slice(0, MAX_SAMPLE_BYTES),
					loopStart: undefined,
					loopLength: undefined
				}
			: resampled
	})

	const out = new ByteWriter()
	out.text(trackerName(song.title, 20), 20)
	for (let index = 0; index < 31; index++) {
		const instrument = song.instruments[index]
		const sample = stored[index]
		if (!instrument || !sample) {
			out.zeros(22).u16be(0).u8(0).u8(0).u16be(0).u16be(1)
			continue
		}
		const length = sample.data.length + (sample.data.length % 2)
		const looped = sample.loopStart !== undefined && sample.loopLength !== undefined
		out.text(trackerName(instrument.name, 22), 22)
		out.u16be(length / 2)
			.u8(MOD_FINETUNE & 0x0f)
			.u8(64)
		out.u16be(looped ? sample.loopStart! / 2 : 0).u16be(looped ? sample.loopLength! / 2 : 1)
	}
	out.u8(order.length).u8(127)
	for (let i = 0; i < 128; i++) {
		out.u8(order[i] ?? 0)
	}
	out.text(tag(channels), 4)

	patterns.forEach((pattern, patternIndex) => {
		for (let row = 0; row < pattern.rows; row++) {
			const line = pattern.cells[row] ?? []
			for (let channel = 0; channel < channels; channel++) {
				const cell = line[channel]
				let period = 0
				let instrument = 0
				let effect = 0
				let parameter = 0
				if (cell?.off) {
					// Cut the note by setting the channel volume to zero
					effect = 0xc
				} else if (cell) {
					period = PERIODS[cell.note - MOD_LOW_NOTE]
					instrument = cell.instrument
					effect = 0xc
					parameter = cell.volume
				} else if (patternIndex === order[0] && row === 0) {
					const slot = free.indexOf(channel)
					if (slot >= 0 && slot < timing.length) {
						effect = 0xf
						parameter = timing[slot]
					}
				}
				out.u8((instrument & 0xf0) | (period >> 8)).u8(period & 0xff)
				out.u8(((instrument & 0x0f) << 4) | effect).u8(parameter)
			}
		}
	})
	stored.forEach((sample) => {
		const pcm = toInt8(sample.data)
		for (let i = 0; i < pcm.length; i++) {
			out.u8(pcm[i])
		}
		if (pcm.length % 2) {
			out.u8(0)
		}
	})
	return out.toUint8Array()
}