/** Native legacy module encoders. Layouts follow the corresponding OpenMPT loaders:
 * https://github.com/OpenMPT/openmpt/tree/master/soundlib (Load_mtm/dsm/ult/669/okt.cpp).
 * All files include PCM samples; these are separate formats, not renamed MOD files.
 */
import { ByteWriter } from "./tracker-bytes"
import { buildPatterns } from "./tracker-grid"
import {
	chooseStorageRate,
	resampleSample,
	evenLoop,
	toInt8,
	MIN_STORAGE_RATE,
	MAX_STORAGE_RATE
} from "./tracker-samples"
import type { TrackerFormatSpec, TrackerSong } from "./tracker-types"

export const MTM_SPEC: TrackerFormatSpec = {
	id: "mtm",
	label: "MultiTracker module",
	minChannels: 4,
	maxChannels: 32,
	channelStep: 1,
	maxInstruments: 63,
	maxSamples: 63,
	keymaps: false,
	envelopes: false,
	maxInstrumentSamples: 1,
	maxOrders: 128,
	noteRange: [37, 99],
	minTempo: 32,
	maxTempo: 255,
	maxSpeed: 31
}
export const DSM_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "dsm",
	label: "DSIK module",
	minChannels: 1,
	maxChannels: 16,
	maxInstruments: 64,
	maxSamples: 64,
	noteRange: [12, 119]
}
export const ULT_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "ult",
	label: "UltraTracker module",
	minChannels: 4,
	maxInstruments: 64,
	maxSamples: 64,
	maxOrders: 255,
	noteRange: [24, 119],
	minTempo: 48,
	maxSpeed: 47
}
export const C669_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "669",
	label: "Composer 669 module",
	minChannels: 8,
	maxChannels: 8,
	maxInstruments: 64,
	maxSamples: 64,
	// At note 99 the top two sample bits collide with 0xFE/0xFF control bytes.
	noteRange: [36, 98],
	minTempo: 78,
	maxTempo: 78,
	maxSpeed: 15
}
export const OKT_SPEC: TrackerFormatSpec = {
	...MTM_SPEC,
	id: "okt",
	label: "Oktalyzer module",
	minChannels: 4,
	maxChannels: 4,
	maxInstruments: 36,
	maxSamples: 36,
	maxOrders: 255,
	noteRange: [48, 83],
	minTempo: 125,
	maxTempo: 125,
	maxSpeed: 255
}

/** Formats without per-sample tuning store PCM at the rate that makes its base note correct. */
export function fixedSamples(song: TrackerSong, baseRate: number) {
	return song.instruments.map(({ samples }) => {
		const sample = samples[0].sample
		return resampleSample(sample, baseRate * 2 ** ((sample.baseNote - 60) / 12), true)
	})
}

/** Reserve timing effects without overwriting a note's volume. */
export function timingRow(source: TrackerSong, slots: number) {
	const spare = Array.from({ length: source.channels }, (_, channel) => channel).filter(
		(channel) => !source.cells[0]?.[channel]
	)
	const leadIn = spare.length < slots
	return {
		song: leadIn ? { ...source, rows: source.rows + 1, cells: [[], ...source.cells] } : source,
		free: leadIn ? Array.from({ length: source.channels }, (_, channel) => channel) : spare
	}
}

export function writeMTM(source: TrackerSong): Uint8Array<ArrayBuffer> {
	const timing = [source.speed, source.tempo]
	const { song, free } = timingRow(source, 2)
	const { patterns, order } = buildPatterns(song, MTM_SPEC, true)
	const stored = fixedSamples(song, 8363)
	const tracks: Uint8Array[] = [],
		indices = new Map<string, number>()
	const maps = patterns.map((pattern, patternIndex) => {
		const map: number[] = []
		for (let channel = 0; channel < 32; channel++) {
			if (channel >= song.channels) {
				map.push(0)
				continue
			}
			const track = new ByteWriter()
			for (let row = 0; row < 64; row++) {
				const cell = pattern.cells[row]?.[channel]
				const note = cell && !cell.off ? cell.note - 36 : 0
				const instrument = cell && !cell.off ? cell.instrument : 0
				let effect = cell ? 12 : 0,
					parameter = cell && !cell.off ? cell.volume : 0
				const slot = free.indexOf(channel)
				if (patternIndex === order[0] && row === 0 && slot >= 0 && slot < 2) {
					effect = 15
					parameter = timing[slot]
				}
				track
					.u8((note << 2) | (instrument >> 4))
					.u8((instrument << 4) | effect)
					.u8(parameter)
			}
			const data = track.toUint8Array(),
				signature = Array.from(data).join(",")
			let index = indices.get(signature)
			if (index === undefined) {
				index = tracks.push(data)
				indices.set(signature, index)
			}
			map.push(index)
		}
		return map
	})
	const out = new ByteWriter()
		.text("MTM", 3)
		.u8(0x10)
		.text(song.title, 20)
		.u16le(tracks.length)
		.u8(patterns.length - 1)
		.u8(order.length - 1)
		.u16le(0)
		.u8(stored.length)
		.u8(0)
		.u8(64)
		.u8(song.channels)
	for (let ch = 0; ch < 32; ch++) {
		out.u8(ch % 2 ? 12 : 3)
	}
	stored.forEach((sample, index) => {
		const loop = sample.loopLength !== undefined
		out.text(song.instruments[index].name, 22)
			.u32le(sample.data.length)
			.u32le(loop ? sample.loopStart! : 0)
			.u32le(loop ? sample.loopStart! + sample.loopLength! + 1 : 0)
			.u8(0)
			.u8(64)
			.u8(0)
	})
	for (let i = 0; i < 128; i++) {
		out.u8(order[i] ?? 0)
	}
	tracks.forEach((data) => out.bytes(data))
	maps.forEach((map) => map.forEach((index) => out.u16le(index)))
	stored.forEach((sample) => {
		for (const value of toInt8(sample.data)) {
			out.u8(value + 128)
		}
	})
	return out.toUint8Array()
}

function riffChunk(out: ByteWriter, tag: string, body: Uint8Array) {
	// DSIK chunks are tightly packed, including odd sample lengths.
	out.text(tag, 4).u32le(body.length).bytes(body)
}

export function writeDSM(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, DSM_SPEC, true)
	const out = new ByteWriter().text("RIFF", 4).u32le(0).text("DSMF", 4)
	const header = new ByteWriter()
		.text(song.title, 28)
		.u16le(0x200)
		.u16le(0)
		.u16le(0)
		.u16le(0)
		.u16le(order.length)
		.u16le(song.instruments.length)
		.u16le(patterns.length)
		.u16le(song.channels)
		.u8(64)
		.u8(0x80)
		.u8(song.speed)
		.u8(song.tempo)
	for (let ch = 0; ch < 16; ch++) {
		header.u8(ch % 2 ? 96 : 32)
	}
	for (let i = 0; i < 128; i++) {
		header.u8(order[i] ?? 255)
	}
	riffChunk(out, "SONG", header.toUint8Array())
	patterns.forEach((pattern) => {
		const data = new ByteWriter().u16le(0)
		for (let row = 0; row < 64; row++) {
			for (let ch = 0; ch < song.channels; ch++) {
				const cell = pattern.cells[row]?.[ch]
				if (!cell) {
					continue
				}
				if (cell.off) {
					data.u8(ch | 0x80).u8(254)
				} else {
					data.u8(ch | 0xe0)
						.u8(cell.note - 11)
						.u8(cell.instrument)
						.u8(cell.volume)
				}
			}
			data.u8(0)
		}
		data.patch16le(0, data.length)
		riffChunk(out, "PATT", data.toUint8Array())
	})
	song.instruments.forEach((instrument, index) => {
		const { sample, lowest } = instrument.samples[0]
		const stored = resampleSample(
			sample,
			chooseStorageRate(sample, lowest, {
				minRate: MIN_STORAGE_RATE,
				maxRate: MAX_STORAGE_RATE
			})
		)
		const loop = stored.loopLength !== undefined
		const data = new ByteWriter()
			.text(`inst${index + 1}.smp`, 13)
			.u16le(loop ? 3 : 2)
			.u8(64)
			.u32le(stored.data.length)
			.u32le(loop ? stored.loopStart! : 0)
			.u32le(loop ? stored.loopStart! + stored.loopLength! : 0)
			.u32le(0)
			.u32le(Math.round(stored.rate * 2 ** ((60 - sample.baseNote) / 12)))
			.text(instrument.name, 28)
			.bytes(toInt8(stored.data))
		riffChunk(out, "INST", data.toUint8Array())
	})
	out.patch32le(4, out.length - 8)
	return out.toUint8Array()
}

export function writeULT(source: TrackerSong): Uint8Array<ArrayBuffer> {
	const { song, free } = timingRow(source, 2)
	const { patterns, order } = buildPatterns(song, ULT_SPEC, true)
	const stored = fixedSamples(song, 8364)
	const out = new ByteWriter()
		.text("MAS_UTrack_V004", 15)
		.text(song.title, 32, 32)
		.u8(0)
		.u8(stored.length)
	stored.forEach((sample, index) => {
		const loop = sample.loopLength !== undefined
		out.text(song.instruments[index].name, 32, 32)
			.text(`inst${index + 1}.smp`, 12, 32)
			.u32le(loop ? sample.loopStart! : 0)
			.u32le(loop ? sample.loopStart! + sample.loopLength! : 0)
			.u32le(0)
			.u32le(sample.data.length)
			.u8(255)
			.u8(loop ? 8 : 0)
			.u16le(4182)
			.u16le(0)
	})
	for (let i = 0; i < 256; i++) {
		out.u8(order[i] ?? 255)
	}
	out.u8(song.channels - 1).u8(patterns.length - 1)
	for (let ch = 0; ch < song.channels; ch++) {
		out.u8(ch % 2 ? 12 : 3)
	}
	for (let ch = 0; ch < song.channels; ch++) {
		patterns.forEach((pattern, patternIndex) => {
			for (let row = 0; row < 64; row++) {
				const cell = pattern.cells[row]?.[ch]
				const timingSlot = free.indexOf(ch)
				if (patternIndex === order[0] && row === 0 && timingSlot >= 0 && timingSlot < 2) {
					out.u8(0)
						.u8(0)
						.u8(0xf)
						.u8(timingSlot === 0 ? song.speed : song.tempo)
						.u8(0)
				} else if (cell?.off) {
					out.u8(0).u8(0).u8(0xc).u8(0).u8(0)
				} else if (cell) {
					out.u8(cell.note - 23)
						.u8(cell.instrument)
						.u8(0xc)
						.u8(Math.round((cell.volume * 255) / 64))
						.u8(0)
				} else {
					out.zeros(5)
				}
			}
		})
	}
	stored.forEach((sample) => out.bytes(toInt8(sample.data)))
	return out.toUint8Array()
}

export function write669(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, C669_SPEC, true)
	const stored = fixedSamples(song, 8363)
	const out = new ByteWriter()
		.text("if", 2)
		.text(song.title, 108, 32)
		.u8(stored.length)
		.u8(patterns.length)
		.u8(0)
	for (let i = 0; i < 128; i++) {
		out.u8(order[i] ?? 255)
	}
	for (let i = 0; i < 128; i++) {
		out.u8(song.speed)
	}
	for (let i = 0; i < 128; i++) {
		out.u8(63)
	}
	stored.forEach((sample, index) => {
		const loop = sample.loopLength !== undefined
		out.text(song.instruments[index].name, 13)
			.u32le(sample.data.length)
			.u32le(loop ? sample.loopStart! : 0)
			.u32le(loop ? sample.loopStart! + sample.loopLength! : 0)
	})
	patterns.forEach((pattern) => {
		for (let row = 0; row < 64; row++) {
			for (let ch = 0; ch < 8; ch++) {
				const cell = pattern.cells[row]?.[ch]
				if (cell?.off) {
					out.u8(254).u8(0).u8(255)
				} else if (cell) {
					const instrument = cell.instrument - 1
					out.u8(((cell.note - 36) << 2) | (instrument >> 4))
						.u8((instrument << 4) | Math.max(1, Math.round((cell.volume * 15) / 64)))
						.u8(255)
				} else {
					out.u8(255).u8(255).u8(255)
				}
			}
		}
	})
	stored.forEach((sample) => {
		for (const value of toInt8(sample.data)) {
			out.u8(value + 128)
		}
	})
	return out.toUint8Array()
}

function iffChunk(out: ByteWriter, tag: string, body: Uint8Array) {
	out.text(tag, 4).u32be(body.length).bytes(body)
}

export function writeOKT(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, OKT_SPEC, false)
	const stored = fixedSamples(song, 8287).map((sample) => {
		const result = evenLoop(sample)
		if (result.data.length > 131070) {
			throw new Error("An Oktalyzer sample exceeds 131,070 bytes; use XM or IT")
		}
		return {
			...result,
			data: result.data.length % 2 ? Float32Array.from([...result.data, 0]) : result.data
		}
	})
	const out = new ByteWriter().text("OKTASONG", 8)
	iffChunk(out, "CMOD", new Uint8Array(8))
	const headers = new ByteWriter()
	stored.forEach((sample, index) => {
		const loop = sample.loopLength !== undefined
		headers
			.text(song.instruments[index].name, 20)
			.u32be(sample.data.length)
			.u16be(loop ? sample.loopStart! / 2 : 0)
			.u16be(loop ? sample.loopLength! / 2 : 0)
			.u16be(64)
			.u16be(1)
	})
	iffChunk(out, "SAMP", headers.toUint8Array())
	iffChunk(out, "SPEE", new ByteWriter().u16be(song.speed).toUint8Array())
	iffChunk(out, "SLEN", new ByteWriter().u16be(patterns.length).toUint8Array())
	iffChunk(out, "PLEN", new ByteWriter().u16be(order.length).toUint8Array())
	iffChunk(out, "PATT", Uint8Array.from(order))
	patterns.forEach((pattern) => {
		const data = new ByteWriter().u16be(pattern.rows)
		for (const line of pattern.cells) {
			for (let ch = 0; ch < 4; ch++) {
				const cell = line[ch]
				if (cell?.off) {
					data.u8(0).u8(0).u8(31).u8(0)
				} else if (cell) {
					data.u8(cell.note - 47)
						.u8(cell.instrument - 1)
						.u8(31)
						.u8(cell.volume)
				} else {
					data.zeros(4)
				}
			}
		}
		iffChunk(out, "PBOD", data.toUint8Array())
	})
	stored.forEach((sample) => iffChunk(out, "SBOD", Uint8Array.from(toInt8(sample.data))))
	return out.toUint8Array()
}