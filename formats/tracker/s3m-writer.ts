/** Scream Tracker 3 module (.s3m) writer: 8-bit unsigned samples, note cut for note ends */

import { ByteWriter, trackerName } from "./tracker-bytes"
import { buildPatterns } from "./tracker-grid"
import {
	MAX_STORAGE_RATE,
	MIN_STORAGE_RATE,
	chooseStorageRate,
	resampleSample,
	toInt8
} from "./tracker-samples"
import type { TrackerFormatSpec, TrackerSong } from "./tracker-types"

/** S3M note bytes are octave * 16 + semitone, and C-4 (0x40) is MIDI 60 as libopenmpt reports it.
 * Octaves 0..7 are reachable, so MIDI 12..107 are playable and the rest are octave-folded.
 */
const S3M_NOTE_OFFSET = 12
export const S3M_SPEC: TrackerFormatSpec = {
	id: "s3m",
	label: "Scream Tracker 3 module",
	minChannels: 1,
	maxChannels: 32,
	channelStep: 1,
	maxInstruments: 99,
	keymaps: false,
	envelopes: false,
	maxInstrumentSamples: 1,
	maxSamples: 99,
	maxOrders: 255,
	noteRange: [S3M_NOTE_OFFSET, S3M_NOTE_OFFSET + 95],
	minTempo: 33,
	maxTempo: 255,
	maxSpeed: 31
}

const NOTE_CUT = 254
const C5_NOTE = 60

const noteByte = (midi: number) => {
	const note = midi - S3M_NOTE_OFFSET
	return ((note / 12) << 4) | (note % 12)
}

export function writeS3M(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, S3M_SPEC, true)
	const instrumentCount = song.instruments.length
	// Order lists are padded to an even length and end with 255
	const orderCount = order.length % 2 ? order.length + 1 : order.length + 2
	const tableEnd = 96 + orderCount + (instrumentCount + patterns.length) * 2 + 32
	const instrumentsAt = Math.ceil(tableEnd / 16) * 16

	const stored = song.instruments.map(({ samples }) => {
		const { sample, lowest } = samples[0]
		const rate = chooseStorageRate(sample, lowest, {
			minRate: MIN_STORAGE_RATE,
			maxRate: MAX_STORAGE_RATE
		})
		return resampleSample(sample, rate)
	})
	const patternBytes = patterns.map((pattern) => {
		const packed = new ByteWriter()
		for (let row = 0; row < pattern.rows; row++) {
			const line = pattern.cells[row] ?? []
			for (let channel = 0; channel < song.channels; channel++) {
				const cell = line[channel]
				if (!cell) {
					continue
				}
				if (cell.off) {
					packed
						.u8(channel | 0x20)
						.u8(NOTE_CUT)
						.u8(0)
				} else {
					packed
						.u8(channel | 0x20 | 0x40)
						.u8(noteByte(cell.note))
						.u8(cell.instrument)
						.u8(cell.volume)
				}
			}
			packed.u8(0)
		}
		const body = packed.toUint8Array()
		const block = new ByteWriter().u16le(body.length + 2).bytes(body)
		return block.align(16).toUint8Array()
	})

	const instrumentsEnd = instrumentsAt + instrumentCount * 80
	const patternOffsets: number[] = []
	let cursor = instrumentsEnd
	for (const bytes of patternBytes) {
		patternOffsets.push(cursor)
		cursor += bytes.length
	}
	const sampleOffsets: number[] = []
	for (const sample of stored) {
		sampleOffsets.push(cursor)
		cursor += Math.ceil(sample.data.length / 16) * 16
	}

	const out = new ByteWriter()
	out.text(trackerName(song.title, 28), 28)
	out.u8(0x1a).u8(16).u16le(0)
	out.u16le(orderCount).u16le(instrumentCount).u16le(patterns.length)
	out.u16le(0).u16le(0x1320).u16le(2)
	out.text("SCRM", 4)
	out.u8(64).u8(song.speed).u8(song.tempo).u8(0xb0).u8(8).u8(0xfc)
	out.zeros(8).u16le(0)
	for (let channel = 0; channel < 32; channel++) {
		// Alternate left and right; channels past 16 reuse the PCM slots, which modern players accept
		out.u8(channel < song.channels ? (channel % 2 ? 8 : 0) + ((channel >> 1) % 8) : 255)
	}
	for (let i = 0; i < orderCount; i++) {
		out.u8(order[i] ?? 255)
	}
	song.instruments.forEach((_, index) => out.u16le((instrumentsAt + index * 80) / 16))
	patternOffsets.forEach((offset) => out.u16le(offset / 16))
	for (let channel = 0; channel < 32; channel++) {
		out.u8(0x20 | (channel % 2 ? 0xc : 0x3))
	}
	out.align(16)

	song.instruments.forEach((instrument, index) => {
		const sample = stored[index]
		const looped = sample.loopStart !== undefined && sample.loopLength !== undefined
		// The sample plays at c2Speed Hz on C-5, so a base note B needs rate * 2^((60 - B) / 12)
		const c2Speed = Math.round(
			sample.rate * 2 ** ((C5_NOTE - instrument.samples[0].sample.baseNote) / 12)
		)
		const paragraph = sampleOffsets[index] / 16
		out.u8(1)
		out.text(trackerName(`inst${index + 1}.smp`, 12), 12)
		out.u8(paragraph >> 16).u16le(paragraph & 0xffff)
		out.u32le(sample.data.length)
		out.u32le(looped ? sample.loopStart! : 0)
		out.u32le(looped ? sample.loopStart! + sample.loopLength! : 0)
		out.u8(64)
			.u8(0)
			.u8(0)
			.u8(looped ? 1 : 0)
		out.u32le(c2Speed)
		out.zeros(12)
		out.text(trackerName(instrument.name, 28), 28)
		out.text("SCRS", 4)
	})
	for (const bytes of patternBytes) {
		out.bytes(bytes)
	}
	stored.forEach((sample) => {
		const pcm = toInt8(sample.data)
		for (let i = 0; i < pcm.length; i++) {
			out.u8(pcm[i] + 128)
		}
		out.align(16)
	})
	return out.toUint8Array()
}