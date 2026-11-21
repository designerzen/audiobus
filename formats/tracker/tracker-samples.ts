/** Sample preparation shared by the tracker writers: length caps, resampling and bit depth */

import type { TrackerSample } from "./tracker-types"

/** Longest one-shot or attack-plus-loop a module carries per instrument */
export const MAX_SAMPLE_SECONDS = 2
/** Samples are stored at or below this rate unless the format dictates otherwise */
export const MAX_STORAGE_RATE = 22050
export const MIN_STORAGE_RATE = 4000

export interface PreparedSample {
	sample: TrackerSample
	/** Cell volume multiplier, from the sample's own volume and its original level */
	gain: number
}

/** Cap the length, normalise to full scale and remember the original level as a gain */
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
	const scaled = new Float32Array(data.length)
	const scale = peak > 0 ? 1 / peak : 1
	for (let i = 0; i < data.length; i++) {
		scaled[i] = Math.max(-1, Math.min(1, data[i] * scale))
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