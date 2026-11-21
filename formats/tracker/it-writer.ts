/** Impulse Tracker module (.it) writer: instrument mode, 16-bit samples, volume envelopes with note-off */

import { ByteWriter, trackerName } from "./tracker-bytes"
import { buildPatterns, releaseTicks } from "./tracker-grid"
import { sampleIndexTable } from "./tracker-instruments"
import {
	MAX_STORAGE_RATE,
	MIN_STORAGE_RATE,
	chooseStorageRate,
	resampleSample,
	sampleSignature,
	toInt16,
	type StoredSample
} from "./tracker-samples"
import type {
	TrackerFormatSpec,
	TrackerInstrument,
	TrackerSample,
	TrackerSong
} from "./tracker-types"

/** IT notes run C-0 to B-9 (0..119); the top MIDI octave folds down */
export const IT_SPEC: TrackerFormatSpec = {
	id: "it",
	label: "Impulse Tracker module",
	minChannels: 1,
	maxChannels: 64,
	channelStep: 1,
	maxInstruments: 99,
	keymaps: true,
	envelopes: true,
	maxInstrumentSamples: 99,
	maxSamples: 99,
	maxOrders: 255,
	noteRange: [0, 119],
	minTempo: 32,
	maxTempo: 255,
	maxSpeed: 31
}

const IT_INSTRUMENT_SIZE = 554
const IT_SAMPLE_SIZE = 80
const NOTE_OFF = 255
const C5_NOTE = 60

function packPattern(song: TrackerSong, rows: TrackerSong["cells"]) {
	const packed = new ByteWriter()
	for (const line of rows) {
		for (let channel = 0; channel < song.channels; channel++) {
			const cell = line[channel]
			if (!cell) {
				continue
			}
			packed.u8((channel + 1) | 0x80)
			if (cell.off) {
				packed.u8(0b001).u8(NOTE_OFF)
			} else {
				packed.u8(0b111).u8(cell.note).u8(cell.instrument).u8(cell.volume)
			}
		}
		packed.u8(0)
	}
	return packed.toUint8Array()
}

function envelope(out: ByteWriter, points: readonly [number, number][], flags: number) {
	out.u8(flags).u8(points.length).u8(0).u8(0)
	// Sustain loop on the first node holds it until note-off
	out.u8(0).u8(0)
	for (let i = 0; i < 25; i++) {
		out.u8(points[i]?.[1] ?? 0).u16le(points[i]?.[0] ?? 0)
	}
	out.u8(0)
}

/** A sample as stored once in the file, however many instruments use it */
interface StoredEntry {
	sample: TrackerSample
	stored: StoredSample
}

function writeInstrument(
	out: ByteWriter,
	instrument: TrackerInstrument,
	index: number,
	song: TrackerSong,
	sampleNumbers: readonly number[]
) {
	const release = releaseTicks(instrument.release, song.tempo)
	// IT fades 1024 steps at fadeout * 32 per tick; aim for about twice the envelope release
	const fadeout = Math.max(1, Math.min(256, Math.round(16 / release)))
	const start = out.length
	out.text("IMPI", 4)
	out.text(trackerName(`inst${index + 1}.its`, 12), 12)
	out.u8(0) // reserved
	out.u8(0).u8(0).u8(0) // new note action cut, duplicate check off
	out.u16le(fadeout)
	out.u8(0).u8(C5_NOTE)
	out.u8(128) // global volume
	out.u8(0x80 | 32) // default pan, ignored
	out.u8(0).u8(0)
	out.u16le(0x0214).u8(1).u8(0)
	out.text(trackerName(instrument.name, 26), 26)
	out.u8(0).u8(0).u8(0).u8(0).u16le(0xffff) // no filter, no MIDI channel or program
	// Each note plays the sample the keymap gives it, untransposed
	sampleIndexTable(instrument, [0, 119]).forEach((sample, note) => {
		out.u8(note).u8(sampleNumbers[sample])
	})
	envelope(
		out,
		[
			[0, 64],
			[release, 0]
		],
		0b101 // envelope on, sustain loop on
	)
	envelope(out, [], 0)
	envelope(out, [], 0)
	out.zeros(IT_INSTRUMENT_SIZE - (out.length - start))
}

export function writeIT(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, IT_SPEC, false)
	const instrumentCount = song.instruments.length

	// Identical samples are stored once and shared between the instruments that use them
	const unique: StoredEntry[] = []
	const bySignature = new Map<string, number>()
	const sampleNumbers = song.instruments.map((instrument) =>
		instrument.samples.map((entry) => {
			const rate = chooseStorageRate(entry.sample, entry.lowest, {
				minRate: MIN_STORAGE_RATE,
				maxRate: MAX_STORAGE_RATE
			})
			const stored = resampleSample(entry.sample, rate)
			const signature = sampleSignature({
				...entry.sample,
				data: stored.data,
				sampleRate: stored.rate,
				loopStart: stored.loopStart,
				loopLength: stored.loopLength
			})
			let number = bySignature.get(signature)
			if (number === undefined) {
				unique.push({ sample: entry.sample, stored })
				number = unique.length
				bySignature.set(signature, number)
			}
			return number
		})
	)
	const sampleCount = unique.length
	const orderCount = order.length + 1
	const headerSize = 0xc0 + orderCount + (instrumentCount + sampleCount + patterns.length) * 4

	const out = new ByteWriter()
	out.text("IMPM", 4)
	out.text(trackerName(song.title, 26), 26)
	out.u8(4).u8(16)
	out.u16le(orderCount).u16le(instrumentCount).u16le(sampleCount).u16le(patterns.length)
	out.u16le(0x0214).u16le(0x0214)
	out.u16le(0b1101) // stereo, instruments, linear slides
	out.u16le(0)
	out.u8(128).u8(64).u8(song.speed).u8(song.tempo)
	out.u8(128).u8(0)
	out.u16le(0).u32le(0).u32le(0)
	for (let channel = 0; channel < 64; channel++) {
		out.u8(32)
	}
	for (let channel = 0; channel < 64; channel++) {
		out.u8(64)
	}
	for (const pattern of order) {
		out.u8(pattern)
	}
	out.u8(255)
	// Offset tables, patched once the sections are placed
	const instrumentTable = out.length
	out.zeros(instrumentCount * 4)
	const sampleTable = out.length
	out.zeros(sampleCount * 4)
	const patternTable = out.length
	out.zeros(patterns.length * 4)
	if (out.length !== headerSize) {
		throw new Error("Internal error laying out the Impulse Tracker header")
	}

	song.instruments.forEach((instrument, index) => {
		out.patch32le(instrumentTable + index * 4, out.length)
		writeInstrument(out, instrument, index, song, sampleNumbers[index])
	})

	const sampleHeaders = out.length
	out.zeros(sampleCount * IT_SAMPLE_SIZE)

	patterns.forEach((pattern, index) => {
		out.patch32le(patternTable + index * 4, out.length)
		const packed = packPattern(song, pattern.cells)
		out.u16le(packed.length).u16le(pattern.rows).u32le(0).bytes(packed)
	})

	unique.forEach(({ sample: source, stored: sample }, index) => {
		const pcm = toInt16(sample.data)
		const looped = sample.loopStart !== undefined && sample.loopLength !== undefined
		const header = sampleHeaders + index * IT_SAMPLE_SIZE
		out.patch32le(sampleTable + index * 4, header)
		// The sample plays at c5Speed Hz on C-5, so a base note B needs c5Speed = rate * 2^((60 - B) / 12)
		const c5Speed = Math.round(sample.rate * 2 ** ((C5_NOTE - source.baseNote) / 12))
		const head = new ByteWriter()
		head.text("IMPS", 4)
		head.text(trackerName(`inst${index + 1}.its`, 12), 12)
		head.u8(0).u8(64)
		head.u8(0b01 | 0b10 | (looped ? 0b10000 : 0)) // present, 16-bit, loop
		head.u8(64)
		head.text(trackerName(source.name, 26), 26)
		head.u8(1).u8(0x80 | 32) // signed samples, default pan ignored
		head.u32le(pcm.length)
		head.u32le(looped ? sample.loopStart! : 0)
		head.u32le(looped ? sample.loopStart! + sample.loopLength! : 0)
		head.u32le(c5Speed)
		head.u32le(0).u32le(0)
		head.u32le(out.length)
		head.u8(0).u8(0).u8(0).u8(0)
		out.patchBytes(header, head.toUint8Array())
		for (let i = 0; i < pcm.length; i++) {
			out.u16le(pcm[i])
		}
	})
	return out.toUint8Array()
}