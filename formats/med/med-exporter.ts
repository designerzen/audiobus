/**
 * OctaMED MMD1 module writer
 * Big-endian Amiga layout: 4-byte notes, up to 64 tracks, 8-bit instruments, names in the
 * expansion data. The playback tempo is stored in BPM mode with four lines per beat.
 */

import { ByteWriter, trackerName } from "../tracker/tracker-bytes"
import { buildPatterns } from "../tracker/tracker-grid"
import { resampleSample, toInt8 } from "../tracker/tracker-samples"
import type { TrackerFormatSpec, TrackerSong } from "../tracker/tracker-types"

/** Samples are stored near this rate and tuned with the instrument's transpose */
const MED_TARGET_RATE = 16726
/** The rate a PAL Amiga plays period 428, which libopenmpt plays an unshifted sample at on MIDI 60 */
const MED_BASE_RATE = 3546894.6 / 428
const MED_REFERENCE_NOTE = 60
/** libopenmpt clamps MED playback to this rate (about period 143), so a sample must be stored
 * low enough that its highest note stays under it
 */
const MED_MAX_PLAY_RATE = 24800
/** Note byte 1 is MIDI 0; libopenmpt reports byte n as note n + 48 + the song transpose of -48 */
const MED_PLAY_TRANSPOSE = -48

/** Note bytes run 1..127, so MIDI 0..126 are playable and 127 is octave-folded */
export const MED_SPEC: TrackerFormatSpec = {
	id: "med",
	label: "OctaMED module",
	minChannels: 4,
	maxChannels: 64,
	channelStep: 1,
	maxInstruments: 63,
	maxOrders: 256,
	noteRange: [0, 126],
	minTempo: 32,
	maxTempo: 255,
	maxSpeed: 31
}

const SONG_FLAG_VOLHEX = 0x10
const SONG_FLAG2_BPM = 0x20
const LINES_PER_BEAT = 4
const SET_VOLUME = 0x0c
const HEADER_SIZE = 52
const SONG_SIZE = 788
const EXPANSION_SIZE = 84
const INSTRUMENT_NAME_SIZE = 40

/** Semitone transpose for a sample. An unshifted sample plays at its stored rate on MIDI 60 and each
 * semitone of transpose raises it one, so the transpose both picks the stored rate and keeps the base
 * note in tune. The rate is as near MED_TARGET_RATE as the highest note it plays allows.
 */
export function medTranspose(baseNote: number, highestNote: number) {
	const wanted = 12 * Math.log2(MED_TARGET_RATE / MED_BASE_RATE) - (baseNote - MED_REFERENCE_NOTE)
	const limit =
		12 * Math.log2(MED_MAX_PLAY_RATE / MED_BASE_RATE) - (highestNote - MED_REFERENCE_NOTE)
	return Math.max(-128, Math.min(127, Math.min(Math.round(wanted), Math.floor(limit))))
}

export function writeMED(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, MED_SPEC, false)
	const instrumentCount = song.instruments.length
	const highest = song.instruments.map((instrument) => instrument.sample.baseNote)
	for (const line of song.cells) {
		for (const cell of line) {
			if (cell && !cell.off) {
				highest[cell.instrument - 1] = Math.max(highest[cell.instrument - 1], cell.note)
			}
		}
	}
	const stored = song.instruments.map((instrument, index) => {
		const transpose = medTranspose(instrument.sample.baseNote, highest[index])
		// The stored rate that makes the base note sound at its own pitch under that transpose
		const rate =
			MED_BASE_RATE *
			2 ** ((instrument.sample.baseNote - MED_REFERENCE_NOTE + transpose) / 12)
		return { transpose, sample: resampleSample(instrument.sample, rate, true) }
	})

	const out = new ByteWriter()
	out.zeros(HEADER_SIZE + SONG_SIZE)
	const blockTable = out.length
	out.zeros(patterns.length * 4)
	const blockOffsets = patterns.map((pattern) => {
		const offset = out.length
		out.u16be(song.channels)
			.u16be(pattern.rows - 1)
			.u32be(0)
		for (let row = 0; row < pattern.rows; row++) {
			const line = pattern.cells[row] ?? []
			for (let channel = 0; channel < song.channels; channel++) {
				const cell = line[channel]
				if (!cell) {
					out.u32be(0)
				} else if (cell.off) {
					out.u8(0).u8(0).u8(SET_VOLUME).u8(0)
				} else {
					out.u8(cell.note + 1)
						.u8(cell.instrument)
						.u8(SET_VOLUME)
						.u8(cell.volume)
				}
			}
		}
		return offset
	})
	blockOffsets.forEach((offset, index) => out.patch32be(blockTable + index * 4, offset))

	const sampleTable = out.length
	out.zeros(instrumentCount * 4)
	stored.forEach(({ sample }, index) => {
		out.patch32be(sampleTable + index * 4, out.length)
		const pcm = toInt8(sample.data)
		out.u32be(pcm.length + (pcm.length % 2)).u16be(0)
		for (let i = 0; i < pcm.length; i++) {
			out.u8(pcm[i])
		}
		out.align(2)
	})

	out.align(4)
	const expansion = out.length
	out.zeros(EXPANSION_SIZE)
	const instrumentInfo = out.length
	for (const instrument of song.instruments) {
		out.text(trackerName(instrument.name, INSTRUMENT_NAME_SIZE - 1), INSTRUMENT_NAME_SIZE)
	}
	const songName = out.length
	const title = trackerName(song.title, 63)
	out.text(title, title.length + 1)
	out.align(4)

	// Expansion data: instrument names and the song name
	const exp = new ByteWriter()
	exp.u32be(0).u32be(0).u16be(0).u16be(0)
	exp.u32be(0).u32be(0)
	exp.u32be(instrumentInfo).u16be(instrumentCount).u16be(INSTRUMENT_NAME_SIZE)
	exp.u32be(0).u32be(0).zeros(4).u32be(0)
	exp.u32be(songName).u32be(title.length + 1)
	exp.u32be(0).u32be(0).u32be(0).u32be(0).zeros(12).u32be(0)
	out.patchBytes(expansion, exp.toUint8Array())

	// File header, then the song structure
	const head = new ByteWriter()
	head.text("MMD1", 4).u32be(out.length).u32be(HEADER_SIZE)
	head.u16be(0).u16be(0)
	head.u32be(blockTable).u32be(0)
	head.u32be(sampleTable).u32be(0).u32be(expansion).u32be(0)
	head.u16be(0).u16be(0).u16be(0).u16be(0).u16be(0).u8(0).u8(0)
	out.patchBytes(0, head.toUint8Array())

	const songHead = new ByteWriter()
	for (let index = 0; index < 63; index++) {
		const entry = stored[index]
		if (!entry) {
			songHead.u16be(0).u16be(1).u8(0).u8(0).u8(0).u8(0)
			continue
		}
		const { sample, transpose } = entry
		const looped = sample.loopStart !== undefined && sample.loopLength !== undefined
		songHead.u16be(looped ? Math.floor(sample.loopStart! / 2) : 0)
		songHead.u16be(looped ? Math.max(2, Math.floor(sample.loopLength! / 2)) : 1)
		songHead
			.u8(0)
			.u8(0)
			.u8(64)
			.u8(transpose & 0xff)
	}
	songHead.u16be(patterns.length).u16be(order.length)
	for (let i = 0; i < 256; i++) {
		songHead.u8(order[i] ?? 0)
	}
	songHead
		.u16be(song.tempo)
		.u8(MED_PLAY_TRANSPOSE & 0xff)
		.u8(SONG_FLAG_VOLHEX)
	songHead.u8(SONG_FLAG2_BPM | (LINES_PER_BEAT - 1)).u8(song.speed)
	for (let track = 0; track < 16; track++) {
		songHead.u8(64)
	}
	songHead.u8(64).u8(instrumentCount)
	out.patchBytes(HEADER_SIZE, songHead.toUint8Array())
	return out.toUint8Array()
}