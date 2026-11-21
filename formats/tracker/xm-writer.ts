/** FastTracker 2 extended module (.xm) writer: 16-bit delta-coded samples, volume envelopes with key-off */

import { ByteWriter, trackerName } from "./tracker-bytes"
import { buildPatterns, releaseTicks } from "./tracker-grid"
import { sampleIndexTable } from "./tracker-instruments"
import {
	MAX_STORAGE_RATE,
	MIN_STORAGE_RATE,
	chooseStorageRate,
	rateSemitones,
	resampleSample,
	toInt16
} from "./tracker-samples"
import type {
	TrackerFormatSpec,
	TrackerInstrument,
	TrackerSample,
	TrackerSong
} from "./tracker-types"

/** Note bytes 1..96 are C-0 to B-7, and FastTracker's C-4 (byte 49) is MIDI 60, so MIDI 12..107 are
 * playable and the rest are octave-folded. libopenmpt reports byte n as note n + 12, so the notes
 * it imports equal the MIDI numbers that were recorded.
 */
const XM_NOTE_OFFSET = 11
export const XM_SPEC: TrackerFormatSpec = {
	id: "xm",
	label: "FastTracker 2 module",
	minChannels: 2,
	maxChannels: 32,
	channelStep: 2,
	maxInstruments: 128,
	keymaps: true,
	envelopes: true,
	maxInstrumentSamples: 16,
	maxSamples: 128 * 16,
	maxOrders: 256,
	noteRange: [XM_NOTE_OFFSET + 1, XM_NOTE_OFFSET + 96],
	minTempo: 32,
	maxTempo: 255,
	maxSpeed: 31
}

const XM_BASE_RATE = 8363
const KEY_OFF = 97

/** XM plays note byte n at 8363 Hz * 2^((n - 49 + relativeNote + finetune/128) / 12), and byte n is
 * MIDI n + 11, so a sample with base note B needs relativeNote + finetune/128 = 60 - B + 12 * log2(rate / 8363)
 */
function sampleTuning(sample: TrackerSample, rate: number) {
	const total = 60 - sample.baseNote + rateSemitones(rate, XM_BASE_RATE)
	let relativeNote = Math.round(total)
	let finetune = Math.round((total - relativeNote) * 128)
	if (finetune > 127) {
		relativeNote++
		finetune -= 128
	}
	return { relativeNote: Math.max(-96, Math.min(95, relativeNote)), finetune }
}

function writeInstrument(out: ByteWriter, instrument: TrackerInstrument, song: TrackerSong) {
	const stored = instrument.samples.map(({ sample, lowest }) => {
		const rate = chooseStorageRate(sample, lowest, {
			minRate: MIN_STORAGE_RATE,
			maxRate: MAX_STORAGE_RATE
		})
		return { sample, stored: resampleSample(sample, rate) }
	})
	const release = releaseTicks(instrument.release, song.tempo)
	// Fade out over roughly twice the envelope release; FT2 caps the value at 0xFFF
	const fadeout = Math.max(1, Math.min(0xfff, Math.round(32768 / (release * 2))))

	out.u32le(263)
	out.text(trackerName(instrument.name, 22), 22)
	out.u8(0).u16le(stored.length).u32le(40)
	// Each note plays the sample the keymap gives it; XM note byte n+1 is index n
	for (const index of sampleIndexTable(instrument, [XM_NOTE_OFFSET + 1, XM_NOTE_OFFSET + 96])) {
		out.u8(index)
	}
	// Volume envelope: hold full volume at point 0 until key-off, then fall to silence
	const points = [
		[0, 64],
		[release, 0]
	]
	for (let i = 0; i < 12; i++) {
		out.u16le(points[i]?.[0] ?? 0).u16le(points[i]?.[1] ?? 0)
	}
	out.zeros(48) // panning envelope
	out.u8(points.length).u8(0)
	out.u8(0).u8(0).u8(0) // volume sustain point 0, no loop
	out.u8(0).u8(0).u8(0)
	out.u8(0b011) // volume envelope on, sustain on
	out.u8(0).u8(0).u8(0).u8(0).u8(0)
	out.u16le(fadeout)
	out.zeros(22)

	const pcms = stored.map(({ stored: data }) => toInt16(data.data))
	stored.forEach(({ sample, stored: data }, index) => {
		const looped = data.loopStart !== undefined && data.loopLength !== undefined
		const { relativeNote, finetune } = sampleTuning(sample, data.rate)
		out.u32le(pcms[index].length * 2)
		out.u32le(looped ? data.loopStart! * 2 : 0)
		out.u32le(looped ? data.loopLength! * 2 : 0)
		out.u8(64)
		out.u8(finetune & 0xff)
		out.u8((looped ? 1 : 0) | 0x10) // forward loop, 16-bit
		out.u8(128)
		out.u8(relativeNote & 0xff)
		out.u8(0)
		out.text(trackerName(sample.name, 22), 22)
	})
	for (const pcm of pcms) {
		let previous = 0
		for (let i = 0; i < pcm.length; i++) {
			out.u16le(pcm[i] - previous)
			previous = pcm[i]
		}
	}
}

export function writeXM(song: TrackerSong): Uint8Array<ArrayBuffer> {
	const { patterns, order } = buildPatterns(song, XM_SPEC, false)
	const out = new ByteWriter()
	out.text("Extended Module: ", 17)
	out.text(trackerName(song.title, 20), 20)
	out.u8(0x1a)
	out.text("HarmonEasy", 20, 0x20)
	out.u16le(0x0104)
	out.u32le(276)
	out.u16le(order.length)
	out.u16le(0)
	out.u16le(song.channels)
	out.u16le(patterns.length)
	out.u16le(song.instruments.length)
	out.u16le(1) // linear frequency table
	out.u16le(song.speed)
	out.u16le(song.tempo)
	for (let i = 0; i < 256; i++) {
		out.u8(order[i] ?? 0)
	}
	for (const pattern of patterns) {
		const packed = new ByteWriter()
		for (const line of pattern.cells) {
			for (let channel = 0; channel < song.channels; channel++) {
				const cell = line[channel]
				if (!cell) {
					packed.u8(0x80)
				} else if (cell.off) {
					packed.u8(0x81).u8(KEY_OFF)
				} else {
					packed
						.u8(0x80 | 1 | 2 | 4)
						.u8(cell.note - XM_NOTE_OFFSET)
						.u8(cell.instrument)
						.u8(0x10 + cell.volume)
				}
			}
		}
		out.u32le(9).u8(0).u16le(pattern.rows).u16le(packed.length)
		out.bytes(packed.toUint8Array())
	}
	for (const instrument of song.instruments) {
		writeInstrument(out, instrument, song)
	}
	return out.toUint8Array()
}