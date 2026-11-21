/** Sample preparation shared by the tracker writers: length caps, tail trimming, resampling and bit depth */

import type { TrackerSample } from "./tracker-types"

/** Longest one-shot or attack-plus-loop a module carries per instrument */
export const MAX_SAMPLE_SECONDS = 2
/** Samples are stored at or below this rate unless the format dictates otherwise */
export const MAX_STORAGE_RATE = 22050
export const MIN_STORAGE_RATE = 4000
/** A one-shot is cut once it falls below this level, relative to its peak */
const TAIL_FLOOR = 10 ** (-54 / 20)
const TAIL_FADE_SECONDS = 0.006
const MIN_ONE_SHOT_FRAMES = 32

export interface PreparedSample {
	sample: TrackerSample
	/** Cell volume multiplier, from the sample's own volume and its original level */
	gain: number
}

/** Cut a one-shot where it has decayed below the tail floor, leaving a short fade out instead of a click */
function trimTail(data: Float32Array, sampleRate: number): Float32Array {
	let last = data.length - 1
	while (last > 0 && Math.abs(data[last]) < TAIL_FLOOR) {
		last--
	}
	const fade = Math.max(8, Math.round(TAIL_FADE_SECONDS * sampleRate))
	const end = Math.max(2, Math.min(data.length, Math.max(MIN_ONE_SHOT_FRAMES, last + 1 + fade)))
	const trimmed = data.slice(0, end)
	const ramp = Math.min(trimmed.length, fade)
	for (let i = 0; i < ramp; i++) {
		trimmed[trimmed.length - 1 - i] *= i / ramp
	}
	return trimmed
}

/** Playback rounding (periods, finetune, integer rates) can run a note this much faster than its pitch implies */
const PLAYBACK_MARGIN = 1.02

/** Source frames a note sounding for `seconds` reads from a sample: it runs faster the higher the note
 * sits above the sample's base note
 */
export const framesPlayed = (sample: TrackerSample, note: number, seconds: number) =>
	seconds * sample.sampleRate * 2 ** ((note - sample.baseNote) / 12)

/** Keep a one-shot only as far as notes read into it, then fade out over a few milliseconds.
 * Looped samples and one-shots that are read to the end are returned as they are.
 */
export function trimToPlayed(sample: TrackerSample, frames: number): TrackerSample {
	const { data } = sample
	if (sample.loopLength !== undefined) {
		return sample
	}
	const fade = Math.max(8, Math.round(TAIL_FADE_SECONDS * sample.sampleRate))
	const keep = Math.max(MIN_ONE_SHOT_FRAMES, Math.ceil(frames * PLAYBACK_MARGIN))
	if (keep + fade >= data.length) {
		return sample
	}
	const trimmed = data.slice(0, keep + fade)
	for (let i = 0; i < fade; i++) {
		trimmed[keep + i] *= 1 - (i + 1) / fade
	}
	return { ...sample, data: trimmed }
}

/** Cap the length, trim the silent tail of a one-shot, normalise to full scale and remember the
 * original level as a gain
 */
export function prepareSample(
	source: TrackerSample,
	maxSeconds = MAX_SAMPLE_SECONDS
): PreparedSample {
	const maxFrames = Math.max(2, Math.round(maxSeconds * source.sampleRate))
	let data = source.data.length ? source.data : new Float32Array(2)
	let loopStart = source.loopStart
	let loopLength = source.loopLength
	if (loopStart !== undefined && loopLength !== undefined && loopLength >= 2) {
		loopStart = Math.max(0, Math.min(Math.floor(loopStart), data.length - 2))
		loopLength = Math.min(Math.floor(loopLength), data.length - loopStart)
		if (loopStart + loopLength > maxFrames) {
			// Keep the loop but shift it earlier so the sample still fits
			loopLength = Math.min(loopLength, Math.max(2, maxFrames >> 1))
			loopStart = Math.max(0, Math.min(loopStart, maxFrames - loopLength))
		}
		data = data.slice(0, loopStart + loopLength)
	} else {
		loopStart = undefined
		loopLength = undefined
		data = data.slice(0, maxFrames)
	}
	let peak = 0
	for (let i = 0; i < data.length; i++) {
		peak = Math.max(peak, Math.abs(data[i]))
	}
	let scaled: Float32Array = new Float32Array(data.length)
	const scale = peak > 0 ? 1 / peak : 1
	for (let i = 0; i < data.length; i++) {
		scaled[i] = Math.max(-1, Math.min(1, data[i] * scale))
	}
	if (loopLength === undefined) {
		scaled = trimTail(scaled, source.sampleRate)
	}
	const volume = Math.max(0, Math.min(1, source.volume ?? 1))
	return {
		sample: {
			...source,
			data: scaled,
			...(loopLength === undefined
				? { loopStart: undefined, loopLength: undefined }
				: { loopStart, loopLength })
		},
		gain: peak > 0 ? Math.min(1, peak) * volume : volume
	}
}

/** Scale a prepared sample down to `level` of full scale; used to keep the relative loudness of the
 * samples that share one instrument, whose cells set a single volume
 */
export function scaleSample(sample: TrackerSample, level: number): TrackerSample {
	if (level >= 1) {
		return sample
	}
	return { ...sample, data: sample.data.map((value) => value * level) }
}

const FNV_PRIME = 0x01000193

/** A fingerprint of everything that decides how a sample sounds once stored: its length, rate, loop,
 * pitch and 16-bit data. Samples with the same signature are stored once.
 */
export function sampleSignature(sample: TrackerSample): string {
	const { data } = sample
	let first = 0x811c9dc5
	let second = 0x9e3779b9
	for (let i = 0; i < data.length; i++) {
		const value = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))) & 0xffff
		first = Math.imul(first ^ (value & 0xff), FNV_PRIME)
		first = Math.imul(first ^ (value >> 8), FNV_PRIME)
		second = Math.imul(second + value, 0x85ebca6b) ^ (second >>> 13)
	}
	return [
		data.length,
		Math.round(sample.sampleRate),
		sample.baseNote,
		sample.loopStart ?? -1,
		sample.loopLength ?? -1,
		(first >>> 0).toString(16),
		(second >>> 0).toString(16)
	].join(":")
}

/** Energy above the bandwidth, relative to the total, that is left out of a sample's stored rate */
const BANDWIDTH_FLOOR = 1e-5
const BANDWIDTH_MARGIN = 1.15
/** Source frequencies that would play above this are inaudible whatever the note */
const AUDIBLE_LIMIT = 18000
const RATE_STEP = 500
const MAX_FFT = 1 << 17

/** In-place radix-2 FFT */
function fft(re: Float64Array, im: Float64Array) {
	const n = re.length
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1
		for (; j & bit; bit >>= 1) {
			j ^= bit
		}
		j ^= bit
		if (i < j) {
			;[re[i], re[j]] = [re[j], re[i]]
			;[im[i], im[j]] = [im[j], im[i]]
		}
	}
	for (let size = 2; size <= n; size <<= 1) {
		const angle = (-2 * Math.PI) / size
		const stepRe = Math.cos(angle)
		const stepIm = Math.sin(angle)
		for (let start = 0; start < n; start += size) {
			let wRe = 1
			let wIm = 0
			for (let k = 0; k < size / 2; k++) {
				const a = start + k
				const b = a + size / 2
				const tRe = re[b] * wRe - im[b] * wIm
				const tIm = re[b] * wIm + im[b] * wRe
				re[b] = re[a] - tRe
				im[b] = im[a] - tIm
				re[a] += tRe
				im[a] += tIm
				const next = wRe * stepRe - wIm * stepIm
				wIm = wRe * stepIm + wIm * stepRe
				wRe = next
			}
		}
	}
}

const bandwidths = new WeakMap<Float32Array, number>()

/** The frequency in Hz below which all but a sliver (-50 dB) of the sample's energy lies */
export function sampleBandwidth(sample: TrackerSample): number {
	const cached = bandwidths.get(sample.data)
	if (cached !== undefined) {
		return cached
	}
	const length = Math.min(sample.data.length, MAX_FFT)
	let size = 2
	while (size < length) {
		size <<= 1
	}
	const re = new Float64Array(size)
	const im = new Float64Array(size)
	for (let i = 0; i < length; i++) {
		// A Hann window keeps the cut at the end of the data from smearing energy upward
		re[i] = sample.data[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, length - 1)))
	}
	fft(re, im)
	const half = size >> 1
	let total = 0
	for (let k = 0; k <= half; k++) {
		total += re[k] * re[k] + im[k] * im[k]
	}
	let bandwidth = 0
	if (total > 0) {
		let above = 0
		let k = half
		while (k > 0 && above + re[k] * re[k] + im[k] * im[k] <= total * BANDWIDTH_FLOOR) {
			above += re[k] * re[k] + im[k] * im[k]
			k--
		}
		bandwidth = (k * sample.sampleRate) / size
	}
	bandwidths.set(sample.data, bandwidth)
	return bandwidth
}

export interface StorageLimits {
	minRate: number
	maxRate: number
}

/** The lowest rate that stores a sample without audible loss, given the notes it plays.
 * The data is kept up to the bandwidth it really has, and no higher than the highest source
 * frequency that is still audible at the lowest note it plays; the rate never rises above the
 * sample's own.
 */
export function chooseStorageRate(
	sample: TrackerSample,
	lowestNote: number,
	limits: StorageLimits
): number {
	const audible = AUDIBLE_LIMIT * 2 ** ((sample.baseNote - lowestNote) / 12)
	const needed = 2 * Math.min(sampleBandwidth(sample), audible) * BANDWIDTH_MARGIN
	const stepped = Math.ceil(needed / RATE_STEP) * RATE_STEP
	return Math.max(limits.minRate, Math.min(limits.maxRate, sample.sampleRate, stepped))
}

export interface StoredSample {
	data: Float32Array
	/** The rate the stored frames really represent; loop rounding can nudge it off the request */
	rate: number
	loopStart?: number
	loopLength?: number
}

/** Repeat the loop this many times at most to land its length on an even whole number of frames */
const MAX_LOOP_REPEATS = 12

/** Resample to `rate`. When the sample loops, the rate is nudged so the loop is a whole number of
 * frames. With `exactRate` set, because the format derives pitch from the rate alone, the rate is held
 * instead and the loop is repeated enough times that rounding its length to an even number of frames
 * detunes it by well under a cent.
 */
export function resampleSample(
	sample: TrackerSample,
	rate: number,
	exactRate = false
): StoredSample {
	const source = sample.data
	const looped = sample.loopStart !== undefined && sample.loopLength !== undefined
	const loopStart = looped ? sample.loopStart! : 0
	const loopLength = looped ? sample.loopLength! : 0
	let ratio = rate / sample.sampleRate
	let repeats = 1
	if (looped && !exactRate) {
		ratio = Math.max(2, Math.round(loopLength * ratio)) / loopLength
	} else if (looped) {
		let bestError = Infinity
		for (let count = 1; count <= MAX_LOOP_REPEATS && bestError > 0.0004; count++) {
			const ideal = count * loopLength * ratio
			const error = Math.abs(Math.max(2, 2 * Math.round(ideal / 2)) - ideal) / ideal
			if (error < bestError) {
				bestError = error
				repeats = count
			}
		}
	}
	// Past the loop end the source wraps round the loop, so interpolation and averaging stay in the cycle
	const at = (index: number) =>
		index < source.length || !looped
			? (source[Math.min(index, source.length - 1)] ?? 0)
			: source[loopStart + ((index - loopStart) % loopLength)]
	const preLoop = looped ? Math.round(loopStart * ratio) : 0
	const loopFrames = looped
		? exactRate
			? Math.max(2, 2 * Math.round((repeats * loopLength * ratio) / 2))
			: Math.max(2, Math.round(loopLength * ratio))
		: 0
	const length = looped ? preLoop + loopFrames : Math.max(2, Math.round(source.length * ratio))
	// Average over the source frames each output frame covers when shrinking, to tame aliasing
	const width = ratio < 1 ? 1 / ratio : 1
	const out = new Float32Array(length)
	for (let i = 0; i < length; i++) {
		const position =
			looped && i >= preLoop ? loopStart + (((i - preLoop) / ratio) % loopLength) : i / ratio
		if (width > 1) {
			const from = Math.floor(position - width / 2 + 0.5)
			const to = Math.max(from + 1, Math.floor(position + width / 2 + 0.5))
			let sum = 0
			for (let index = Math.max(0, from); index < to; index++) {
				sum += at(index)
			}
			out[i] = sum / (to - Math.max(0, from))
		} else {
			const index = Math.floor(position)
			const fraction = position - index
			out[i] = at(index) + (at(index + 1) - at(index)) * fraction
		}
	}
	if (!looped) {
		return { data: out, rate: sample.sampleRate * ratio }
	}
	return {
		data: out,
		rate: sample.sampleRate * ratio,
		loopStart: preLoop,
		loopLength: loopFrames
	}
}

/** Even loop start and length for formats that count loops in 16-bit words, trimming the data to the loop */
export function evenLoop(stored: StoredSample): StoredSample {
	if (stored.loopStart === undefined || stored.loopLength === undefined) {
		return stored
	}
	const loopStart = stored.loopStart & ~1
	const loopLength = Math.max(2, stored.loopLength & ~1)
	return {
		...stored,
		data: stored.data.slice(0, loopStart + loopLength),
		loopStart,
		loopLength
	}
}

export const toInt8 = (data: Float32Array): Int8Array => {
	const out = new Int8Array(data.length)
	for (let i = 0; i < data.length; i++) {
		out[i] = Math.max(-128, Math.min(127, Math.round(data[i] * 127)))
	}
	return out
}

export const toInt16 = (data: Float32Array): Int16Array => {
	const out = new Int16Array(data.length)
	for (let i = 0; i < data.length; i++) {
		out[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)))
	}
	return out
}

/** Equal-tempered semitone distance between two sample rates */
export const rateSemitones = (rate: number, reference: number) => 12 * Math.log2(rate / reference)