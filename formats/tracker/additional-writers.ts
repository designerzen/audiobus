/** Native STM, ASYLUM AMF and PTM encoders with embedded PCM samples.
 * Binary layouts: OpenMPT soundlib/Load_stm.cpp, Load_amf.cpp and Load_ptm.cpp.
 */
import { ByteWriter } from "./tracker-bytes"
import { buildPatterns } from "./tracker-grid"
import { fixedSamples, timingRow, MTM_SPEC } from "./legacy-writers"
import { toInt8 } from "./tracker-samples"
import type { TrackerFormatSpec, TrackerSong } from "./tracker-types"

export const STM_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "stm",
	label: "Scream Tracker 2 module",
	minChannels: 4,
	maxChannels: 4,
	maxInstruments: 31,
	maxSamples: 31,
	noteRange: [36, 107],
	minTempo: 125,
	maxTempo: 125,
	maxSpeed: 15
}
export const AMF_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "amf",
	label: "ASYLUM module",
	minChannels: 8,
	maxChannels: 8,
	maxInstruments: 64,
	maxSamples: 64,
	maxOrders: 255,
	noteRange: [13, 119]
}
export const PTM_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "ptm",
	label: "PolyTracker module",
	maxInstruments: 255,
	maxSamples: 255,
	noteRange: [0, 119]
}

export function writeSTM(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, STM_SPEC, true)
	if (patterns.length > 64) {
		throw new Error("Scream Tracker 2 supports at most 64 distinct patterns; use S3M or IT")
	}
	const stored = fixedSamples(song, 8363)
	const offsets: number[] = []
	let cursor = 1168 + patterns.length * 1024
	for (const sample of stored) {
		if (sample.data.length > 65535) {
			throw new Error("A Scream Tracker 2 sample exceeds 65,535 bytes; use S3M or IT")
		}
		if (sample.loopLength !== undefined && sample.loopStart! + sample.loopLength === 65535) {
			throw new Error(
				"Scream Tracker 2 reserves loop end 65,535 for unlooped samples; use S3M or IT"
			)
		}
		if (cursor > 0xffff0) {
			throw new Error("Scream Tracker 2 sample offsets exceed 1 MB; use S3M or IT")
		}
		offsets.push(cursor)
		cursor += Math.ceil(sample.data.length / 16) * 16
	}
	const out = new ByteWriter()
		.text(song.title, 20)
		.text("!Scream!", 8)
		.u8(0x1a)
		.u8(2)
		.u8(2)
		.u8(21)
		.u8(song.speed << 4)
		.u8(patterns.length)
		.u8(64)
		.zeros(13)
	for (let index = 0; index < 31; index++) {
		const sample = stored[index]
		if (!sample) {
			out.zeros(32)
			continue
		}
		const loop = sample.loopLength !== undefined
		out.text(song.instruments[index].name, 12)
			.u8(0)
			.u8(0)
			.u16le(offsets[index] / 16)
			.u16le(sample.data.length)
			.u16le(loop ? sample.loopStart! : 0)
			.u16le(loop ? sample.loopStart! + sample.loopLength! : 65535)
			.u8(64)
			.u8(0)
			.u16le(8363)
			.zeros(6)
	}
	for (let index = 0; index < 128; index++) {
		out.u8(order[index] ?? 99)
	}
	patterns.forEach((pattern) => {
		for (const line of pattern.cells) {
			for (let channel = 0; channel < 4; channel++) {
				const cell = line[channel]
				if (!cell) {
					// A packed volume above 64 means no volume change.
					out.u8(255).u8(0).u8(0x90).u8(0)
					continue
				}
				if (cell.off) {
					out.u8(254).u8(0).u8(0x90).u8(0)
					continue
				}
				const pitch = cell.note - 36
				out.u8((Math.floor(pitch / 12) << 4) | (pitch % 12))
					.u8((cell.instrument << 3) | (cell.volume & 7))
					.u8((cell.volume & 0x78) << 1)
					.u8(0)
			}
		}
	})
	stored.forEach((sample) => out.bytes(toInt8(sample.data)).align(16))
	return out.toUint8Array()
}

export function writeAMF(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, AMF_SPEC, true)
	const stored = fixedSamples(song, 8363)
	const out = new ByteWriter()
		.text("ASYLUM Music Format V1.0", 32)
		.u8(song.speed)
		.u8(song.tempo)
		.u8(stored.length)
		.u8(patterns.length)
		.u8(order.length)
		.u8(0)
	for (let index = 0; index < 256; index++) {
		out.u8(order[index] ?? 255)
	}
	for (let index = 0; index < 64; index++) {
		const sample = stored[index]
		if (!sample) {
			out.zeros(37)
			continue
		}
		const loop = sample.loopLength !== undefined
		out.text(song.instruments[index].name, 22)
			.u8(0)
			.u8(64)
			.u8(0)
			.u32le(sample.data.length)
			.u32le(loop ? sample.loopStart! : 0)
			.u32le(loop ? sample.loopLength! : 0)
	}
	patterns.forEach((pattern) => {
		for (const line of pattern.cells) {
			for (let channel = 0; channel < 8; channel++) {
				const cell = line[channel]
				if (cell?.off) {
					out.u8(0).u8(0).u8(12).u8(0)
				} else if (cell) {
					out.u8(cell.note - 12)
						.u8(cell.instrument)
						.u8(12)
						.u8(cell.volume)
				} else {
					out.zeros(4)
				}
			}
		}
	})
	stored.forEach((sample) => out.bytes(toInt8(sample.data)))
	return out.toUint8Array()
}

export function writePTM(source: TrackerSong): Uint8Array<ArrayBuffer> {
	const { song, free } = timingRow(source, 2)
	const { patterns, order } = buildPatterns(song, PTM_SPEC, true)
	const stored = fixedSamples(song, 8364)
	const packed = patterns.map((pattern, patternIndex) => {
		const data = new ByteWriter()
		for (let row = 0; row < 64; row++) {
			for (let channel = 0; channel < song.channels; channel++) {
				const slot = free.indexOf(channel)
				if (patternIndex === order[0] && row === 0 && slot >= 0 && slot < 2) {
					data.u8(channel | 0x40)
						.u8(15)
						.u8(slot === 0 ? song.speed : song.tempo)
					continue
				}
				const cell = pattern.cells[row]?.[channel]
				if (cell?.off) {
					data.u8(channel | 0x20)
						.u8(254)
						.u8(0)
				} else if (cell) {
					data.u8(channel | 0xa0)
						.u8(cell.note + 1)
						.u8(cell.instrument)
						.u8(cell.volume)
				}
			}
			data.u8(0)
		}
		return data.align(16).toUint8Array()
	})
	const patternOffsets: number[] = [],
		sampleOffsets: number[] = []
	let cursor = Math.ceil((608 + stored.length * 80) / 16) * 16
	for (const pattern of packed) {
		if (cursor > 0xffff0) {
			throw new Error("PolyTracker pattern offsets exceed 1 MB; use IT")
		}
		patternOffsets.push(cursor)
		cursor += pattern.length
	}
	for (const sample of stored) {
		sampleOffsets.push(cursor)
		cursor += sample.data.length
	}
	const out = new ByteWriter()
		.text(song.title, 28)
		.u8(26)
		.u8(3)
		.u8(2)
		.u8(0)
		.u16le(order.length)
		.u16le(stored.length)
		.u16le(patterns.length)
		.u16le(song.channels)
		.u16le(0)
		.u16le(0)
		.text("PTMF", 4)
		.zeros(16)
	for (let channel = 0; channel < 32; channel++) {
		out.u8(channel % 2 ? 12 : 3)
	}
	for (let index = 0; index < 256; index++) {
		out.u8(order[index] ?? 255)
	}
	for (let index = 0; index < 128; index++) {
		out.u16le((patternOffsets[index] ?? 0) / 16)
	}
	stored.forEach((sample, index) => {
		const loop = sample.loopLength !== undefined
		out.u8(loop ? 5 : 1)
			.text(`inst${index + 1}.smp`, 12)
			.u8(64)
			.u16le(4182)
			.u16le(0)
			.u32le(sampleOffsets[index])
			.u32le(sample.data.length)
			.u32le(loop ? sample.loopStart! : 0)
			.u32le(loop ? sample.loopStart! + sample.loopLength! + 1 : 0)
			.zeros(14)
			.text(song.instruments[index].name, 28)
			.text("PTMS", 4)
	})
	out.align(16)
	packed.forEach((pattern) => out.bytes(pattern))
	stored.forEach((sample) => {
		let previous = 0
		for (const value of toInt8(sample.data)) {
			out.u8(value - previous)
			previous = value
		}
	})
	return out.toUint8Array()
}