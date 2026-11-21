/**
 * Fallback instrument timbres for tracker export
 * Deterministic pure JS PCM approximations of the General MIDI families, used when no timbre was
 * captured from the live instrument. No Web Audio, so it runs in node and in tests.
 */

import type { TrackerSample } from "./tracker-types"

export const TIMBRE_RATE = 22050
/** Loops shorter than this alias badly once a tracker transposes them */
const MIN_LOOP_FRAMES = 480
/** Target RMS of the sample body, so sustained pads do not drown out plucks */
const TARGET_RMS = 0.45

export const GM_FAMILIES = [
	"Piano",
	"Chrom Perc",
	"Organ",
	"Guitar",
	"Bass",
	"Strings",
	"Ensemble",
	"Brass",
	"Reed",
	"Pipe",
	"Lead",
	"Pad",
	"Synth FX",
	"Ethnic",
	"Percussive",
	"Sound FX"
] as const

interface Voice {
	data: Float32Array
	loopStart?: number
	loopLength?: number
	base: number
}

interface Tone {
	ratio: number
	amp: number
	/** Exponential decay in 1/s */
	decay?: number
}

const midiFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12)

/** mulberry32: small seeded generator returning -1..1 */
const noiseSource = (seed: number) => {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
	}
}

const seconds = (value: number) => Math.round(value * TIMBRE_RATE)

/** Single-pole high-pass, in place */
function highpass(data: Float32Array, cutoff: number) {
	const a = 1 / (1 + (2 * Math.PI * cutoff) / TIMBRE_RATE)
	let previousIn = 0
	let previousOut = 0
	for (let i = 0; i < data.length; i++) {
		const input = data[i]
		previousOut = a * (previousOut + input - previousIn)
		previousIn = input
		data[i] = previousOut
	}
	return data
}

/** Single-pole low-pass, in place */
function lowpass(data: Float32Array, cutoff: number) {
	const a = 1 - Math.exp((-2 * Math.PI * cutoff) / TIMBRE_RATE)
	let previous = 0
	for (let i = 0; i < data.length; i++) {
		previous += a * (data[i] - previous)
		data[i] = previous
	}
	return data
}

/** Additive voice that keeps sounding: an attack followed by a loop of whole fundamental cycles.
 * Every partial is a whole number of cycles per loop, so the loop wraps without a click and starts
 * and ends on a zero crossing.
 */
function sustained(
	base: number,
	partials: readonly Tone[],
	options: { attack: number; bright?: number; breath?: number; drive?: number; seed: number }
): Voice {
	const period = TIMBRE_RATE / midiFrequency(base)
	// An even cycle count keeps half-integer partial ratios periodic as well
	const cycles = 2 * Math.ceil(MIN_LOOP_FRAMES / period / 2)
	const loopLength = Math.round(cycles * period)
	const attackLength =
		loopLength * Math.max(1, Math.ceil((options.attack * TIMBRE_RATE) / loopLength))
	const total = attackLength + loopLength
	const table = new Float32Array(loopLength)
	for (let i = 0; i < loopLength; i++) {
		table[i] = Math.sin((2 * Math.PI * i) / loopLength)
	}
	const data = new Float32Array(total)
	const nyquistCycles = (loopLength / 2) * 0.96
	for (const partial of partials) {
		const cycleCount = Math.round(partial.ratio * cycles)
		if (cycleCount < 1 || cycleCount >= nyquistCycles) {
			continue
		}
		const exponent = 1 + (options.bright ?? 0) * Math.max(0, partial.ratio - 1) * 0.25
		for (let i = 0; i < total; i++) {
			const ramp = i < attackLength ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attackLength) : 1
			const gain = exponent === 1 ? ramp : ramp ** exponent
			data[i] += partial.amp * gain * table[(cycleCount * i) % loopLength]
		}
	}
	if (options.breath) {
		const noise = noiseSource(options.seed)
		for (let i = 0; i < attackLength; i++) {
			const ramp = 0.5 - 0.5 * Math.cos((Math.PI * i) / attackLength)
			data[i] += options.breath * noise() * Math.sin(Math.PI * ramp)
		}
	}
	if (options.drive) {
		for (let i = 0; i < total; i++) {
			data[i] = Math.tanh(options.drive * data[i])
		}
	}
	return { data, base, loopStart: attackLength, loopLength }
}

/** Inharmonic or harmonic partials that each die away, for struck and plucked-bar sounds */
function decaying(
	base: number,
	partials: readonly Tone[],
	options: { length: number; noise?: number; noiseDecay?: number; seed: number }
): Voice {
	const f0 = midiFrequency(base)
	const total = seconds(options.length)
	const data = new Float32Array(total)
	for (const partial of partials) {
		const frequency = partial.ratio * f0
		if (frequency >= TIMBRE_RATE * 0.48) {
			continue
		}
		const step = (2 * Math.PI * frequency) / TIMBRE_RATE
		const decay = (partial.decay ?? 3) / TIMBRE_RATE
		for (let i = 0; i < total; i++) {
			data[i] += partial.amp * Math.exp(-decay * i) * Math.sin(step * i)
		}
	}
	if (options.noise) {
		const noise = noiseSource(options.seed)
		const burst = new Float32Array(total)
		for (let i = 0; i < burst.length; i++) {
			burst[i] = noise() * Math.exp((-(options.noiseDecay ?? 120) * i) / TIMBRE_RATE)
		}
		lowpass(burst, f0 * 6)
		for (let i = 0; i < total; i++) {
			data[i] += options.noise * burst[i]
		}
	}
	return { data, base }
}

/** Karplus-Strong string with a fractional delay, so the pitch stays in tune */
function pluck(
	base: number,
	options: {
		length: number
		/** 0 dark .. 1 bright excitation */
		bright: number
		/** Seconds for the string to fall by 60 dB */
		sustain: number
		drive?: number
		seed: number
	}
): Voice {
	const period = TIMBRE_RATE / midiFrequency(base)
	const delay = period - 0.5
	const whole = Math.floor(delay)
	const fraction = delay - whole
	const total = seconds(options.length)
	const data = new Float32Array(total)
	const noise = noiseSource(options.seed)
	const size = Math.min(total, whole + 2)
	let excitation = 0
	for (let i = 0; i < size; i++) {
		// Blend white noise through a one-pole filter to control how bright the pick sounds
		excitation += (1 - 0.92 * (1 - options.bright)) * (noise() - excitation)
		data[i] = excitation
	}
	const feedback = Math.min(0.9999, 0.001 ** (1 / (options.sustain * midiFrequency(base))))
	const read = (i: number) => data[i - whole] * (1 - fraction) + data[i - whole - 1] * fraction
	for (let i = size; i < total; i++) {
		data[i] = feedback * 0.5 * (read(i) + read(i - 1))
	}
	// Lead in from silence rather than starting on a noise sample
	for (let i = 0; i < Math.min(total, 8); i++) {
		data[i] *= i / 8
	}
	if (options.drive) {
		for (let i = 0; i < total; i++) {
			data[i] = Math.tanh(options.drive * data[i] * 2)
		}
	}
	return { data, base }
}

/** Periodic noise: a loop of band-limited random partials, so any start point wraps seamlessly */
function noiseLoop(
	low: number,
	high: number,
	options: { length: number; seed: number; modulation?: number }
): Voice {
	const loopLength = seconds(options.length)
	const noise = noiseSource(options.seed)
	const table = new Float32Array(loopLength)
	for (let i = 0; i < loopLength; i++) {
		table[i] = Math.sin((2 * Math.PI * i) / loopLength)
	}
	const data = new Float32Array(loopLength * 2)
	const first = Math.max(1, Math.round(low * options.length))
	const last = Math.round(high * options.length)
	for (let k = first; k <= last; k++) {
		const amp = (noise() + 1) / 2 / Math.sqrt(k)
		const phase = Math.floor(((noise() + 1) / 2) * loopLength)
		for (let i = 0; i < data.length; i++) {
			data[i] += amp * table[(k * i + phase) % loopLength]
		}
	}
	if (options.modulation) {
		for (let i = 0; i < data.length; i++) {
			data[i] *= 0.55 + 0.45 * Math.sin((2 * Math.PI * options.modulation * i) / TIMBRE_RATE)
		}
	}
	// Both ends of the loop sit on the same zero crossing
	let start = 0
	for (let i = 1; i < loopLength; i++) {
		if (data[i - 1] <= 0 && data[i] > 0) {
			start = i
			break
		}
	}
	return {
		data: data.slice(0, start + loopLength),
		base: 60,
		loopStart: start,
		loopLength
	}
}

const harmonicSeries = (count: number, amp: (h: number) => number): Tone[] =>
	Array.from({ length: count }, (_, i) => ({ ratio: i + 1, amp: amp(i + 1) }))

const oddHarmonics = (count: number, amp: (h: number) => number): Tone[] =>
	Array.from({ length: count }, (_, i) => ({ ratio: 2 * i + 1, amp: amp(2 * i + 1) }))

/** Harmonics shaped by formant peaks (Hz), for voice-like and reedy sounds */
const formants = (base: number, count: number, peaks: readonly [number, number][]): Tone[] => {
	const f0 = midiFrequency(base)
	return harmonicSeries(count, (h) =>
		peaks.reduce(
			(sum, [centre, width]) => sum + Math.exp(-(((h * f0 - centre) / width) ** 2)),
			0.04 / h
		)
	)
}

const bell = (decays: readonly number[], ratios: readonly number[]): Tone[] =>
	ratios.map((ratio, i) => ({ ratio, amp: 1 / (1 + i * 0.6), decay: decays[i] ?? decays.at(-1) }))

const BELL_RATIOS = [1, 2.76, 5.4, 8.93]
const BAR_RATIOS = [1, 4, 10]

function pianoFamily(program: number, seed: number): Voice {
	switch (program) {
		case 4:
		case 5:
			// Electric piano: sine fundamental with a short tine overtone
			return decaying(
				60,
				[
					{ ratio: 1, amp: 1, decay: 1.4 },
					{ ratio: 2, amp: 0.35, decay: 2.6 },
					{ ratio: 7, amp: 0.25, decay: 9 }
				],
				{ length: 1.6, noise: 0.15, seed }
			)
		case 6:
			return pluck(60, { length: 1.2, bright: 0.95, sustain: 1.1, seed })
		case 7:
			return pluck(60, { length: 0.8, bright: 0.9, sustain: 0.45, drive: 1.5, seed })
		default: {
			// Stretched harmonics that decay faster the higher they are
			const stiffness = 0.0004
			const brightness = program === 1 ? 1.25 : program === 3 ? 0.9 : 1
			return decaying(
				60,
				Array.from({ length: 14 }, (_, i) => {
					const h = i + 1
					return {
						ratio: h * Math.sqrt(1 + stiffness * h * h),
						amp: (brightness * (h === 2 ? 0.8 : 1)) / h ** 0.95,
						decay: 0.9 + 0.35 * h
					}
				}),
				{ length: 2, noise: 0.25, noiseDecay: 300, seed }
			)
		}
	}
}

function chromaticFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return decaying(72, bell([3, 6, 10], [1, 2.76, 5.4]), { length: 1.1, seed })
		case 1:
			return decaying(72, bell([2.5, 5, 9, 14], BELL_RATIOS), {
				length: 1.4,
				noise: 0.1,
				seed
			})
		case 2:
			return decaying(
				72,
				harmonicSeries(4, (h) => 1 / h ** 1.5).map((p) => ({ ...p, decay: 3 })),
				{
					length: 1,
					seed
				}
			)
		case 3:
			return decaying(60, bell([1.6, 6, 12], [1, 4, 10]), { length: 2, seed })
		case 4:
			return decaying(60, bell([5, 14, 30], BAR_RATIOS), { length: 0.8, noise: 0.2, seed })
		case 5:
			return decaying(72, bell([6, 18, 30], [1, 3, 6]), { length: 0.6, noise: 0.3, seed })
		case 6:
			return decaying(60, bell([1, 1.4, 2, 3, 4], [1, 2, 2.76, 4.07, 5.4]), {
				length: 2,
				seed
			})
		default:
			return pluck(60, { length: 1.4, bright: 0.8, sustain: 1.2, seed })
	}
}

function organFamily(program: number, seed: number): Voice {
	const options = { attack: 0.01, seed }
	switch (program) {
		case 0:
			return sustained(
				60,
				[
					{ ratio: 0.5, amp: 0.6 },
					{ ratio: 1, amp: 1 },
					{ ratio: 2, amp: 0.8 },
					{ ratio: 3, amp: 0.6 },
					{ ratio: 4, amp: 0.45 },
					{ ratio: 6, amp: 0.3 },
					{ ratio: 8, amp: 0.25 }
				],
				options
			)
		case 1:
			return sustained(
				60,
				[
					{ ratio: 1, amp: 1 },
					{ ratio: 2, amp: 0.6 },
					{ ratio: 3, amp: 0.8 },
					{ ratio: 4, amp: 0.3 }
				],
				{ ...options, attack: 0.004, bright: 3 }
			)
		case 2:
			return sustained(
				60,
				harmonicSeries(8, (h) => (h % 2 ? 1 : 0.55) / h ** 0.6),
				{
					...options,
					drive: 1.8
				}
			)
		case 3:
			return sustained(
				48,
				harmonicSeries(10, (h) => 1 / h ** 0.7),
				{ ...options, attack: 0.05 }
			)
		case 4:
			return sustained(
				60,
				oddHarmonics(6, (h) => 1 / h ** 0.9),
				options
			)
		case 5:
		case 7:
			return sustained(
				60,
				harmonicSeries(12, (h) => 1 / h ** 0.8),
				{ ...options, attack: 0.04 }
			)
		default:
			return sustained(60, formants(60, 14, [[1400, 600]]), { ...options, attack: 0.03 })
	}
}

function guitarFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return pluck(55, { length: 1.8, bright: 0.35, sustain: 1.8, seed })
		case 1:
			return pluck(55, { length: 2, bright: 0.75, sustain: 2.2, seed })
		case 2:
			return pluck(55, { length: 1.8, bright: 0.25, sustain: 2, seed })
		case 3:
			return pluck(55, { length: 1.8, bright: 0.45, sustain: 2, seed })
		case 4:
			return pluck(55, { length: 0.6, bright: 0.3, sustain: 0.3, seed })
		case 5:
			return pluck(55, { length: 2, bright: 0.8, sustain: 2.4, drive: 2.5, seed })
		case 6:
			return pluck(55, { length: 2, bright: 0.9, sustain: 2.6, drive: 6, seed })
		default:
			return decaying(
				67,
				[
					{ ratio: 1, amp: 1, decay: 2 },
					{ ratio: 3, amp: 0.6, decay: 2.5 },
					{ ratio: 4, amp: 0.4, decay: 3 }
				],
				{ length: 1.4, seed }
			)
	}
}

function bassFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return pluck(40, { length: 1.6, bright: 0.2, sustain: 1.8, seed })
		case 1:
			return pluck(40, { length: 1.5, bright: 0.28, sustain: 1.6, seed })
		case 2:
			return pluck(40, { length: 1.5, bright: 0.55, sustain: 1.5, seed })
		case 3:
			return pluck(40, { length: 1.8, bright: 0.15, sustain: 2.2, seed })
		case 4:
		case 5:
			return pluck(40, { length: 1.1, bright: 0.95, sustain: 1, drive: 1.3, seed })
		case 6:
			return decaying(
				40,
				harmonicSeries(14, (h) => Math.exp(-h / 7) / h).map((p) => ({
					...p,
					decay: 1.5 + p.ratio * 0.4
				})),
				{ length: 1.2, seed }
			)
		default:
			return decaying(
				40,
				oddHarmonics(8, (h) => 1 / h).map((p) => ({ ...p, decay: 1.2 + p.ratio * 0.3 })),
				{ length: 1.2, noise: 0.1, seed }
			)
	}
}

function stringFamily(program: number, seed: number): Voice {
	const bowed = (base: number, exponent: number, bright: number) =>
		sustained(
			base,
			harmonicSeries(18, (h) => 1 / h ** exponent),
			{
				attack: 0.09,
				bright,
				breath: 0.03,
				seed
			}
		)
	switch (program) {
		case 0:
			return bowed(67, 0.85, 3)
		case 1:
			return bowed(60, 1, 2.5)
		case 2:
			return bowed(48, 1.15, 2)
		case 3:
			return bowed(36, 1.3, 1.5)
		case 4:
			return sustained(
				60,
				harmonicSeries(16, (h) => 1 / h),
				{ attack: 0.03, bright: 4, seed }
			)
		case 5:
			return pluck(60, { length: 0.7, bright: 0.6, sustain: 0.55, seed })
		case 6:
			return pluck(72, { length: 2, bright: 0.3, sustain: 2.4, seed })
		default:
			return decaying(
				45,
				[
					{ ratio: 1.12, amp: 0.4, decay: 14 },
					{ ratio: 1, amp: 1, decay: 2.4 },
					{ ratio: 1.5, amp: 0.25, decay: 3.5 }
				],
				{ length: 1.6, noise: 0.5, noiseDecay: 50, seed }
			)
	}
}

function ensembleFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
		case 1:
			return sustained(60, [...harmonicSeries(16, (h) => 1 / h), { ratio: 0.5, amp: 0.4 }], {
				attack: 0.25,
				bright: 2,
				seed
			})
		case 2:
			return sustained(
				60,
				harmonicSeries(14, (h) => 1 / h ** 0.9),
				{ attack: 0.12, bright: 3, seed }
			)
		case 3:
			return sustained(
				60,
				oddHarmonics(10, (h) => 1 / h ** 0.7),
				{ attack: 0.12, seed }
			)
		case 4:
			return sustained(
				60,
				formants(60, 24, [
					[800, 220],
					[1200, 300],
					[2600, 400]
				]),
				{
					attack: 0.18,
					seed
				}
			)
		case 5:
			return sustained(
				60,
				formants(60, 24, [
					[330, 120],
					[700, 200],
					[2400, 400]
				]),
				{
					attack: 0.2,
					seed
				}
			)
		case 6:
			return sustained(
				60,
				formants(60, 30, [
					[600, 250],
					[1000, 300],
					[2500, 500]
				]),
				{
					attack: 0.1,
					bright: 1,
					drive: 1.4,
					seed
				}
			)
		default:
			return decaying(
				60,
				[1, 1.26, 1.5, 2, 2.52].flatMap((ratio) =>
					harmonicSeries(6, (h) => 1 / h).map((p) => ({
						ratio: ratio * p.ratio,
						amp: p.amp,
						decay: 4 + p.ratio
					}))
				),
				{ length: 0.8, noise: 0.2, seed }
			)
	}
}

function brassFamily(program: number, seed: number): Voice {
	const horn = (base: number, exponent: number, bright: number, attack = 0.07) =>
		sustained(
			base,
			harmonicSeries(16, (h) => 1 / h ** exponent),
			{
				attack,
				bright,
				breath: 0.02,
				seed
			}
		)
	switch (program) {
		case 0:
			return horn(66, 0.45, 5)
		case 1:
			return horn(55, 0.7, 4)
		case 2:
			return horn(36, 0.95, 3, 0.09)
		case 3:
			return sustained(66, formants(66, 20, [[1300, 400]]), { attack: 0.05, bright: 2, seed })
		case 4:
			return horn(55, 1.1, 2, 0.1)
		case 5:
			return horn(60, 0.5, 4.5, 0.06)
		case 6:
			return sustained(
				60,
				harmonicSeries(20, (h) => 1 / h ** 0.6),
				{ attack: 0.05, bright: 3, drive: 1.2, seed }
			)
		default:
			return sustained(
				60,
				harmonicSeries(20, (h) => 1 / h ** 0.75),
				{ attack: 0.07, bright: 3.5, seed }
			)
	}
}

function reedFamily(program: number, seed: number): Voice {
	const reed = (base: number, peak: number, width: number, attack = 0.04) =>
		sustained(base, formants(base, 20, [[peak, width]]), { attack, breath: 0.04, seed })
	switch (program) {
		case 0:
			return reed(70, 1500, 700)
		case 1:
			return reed(62, 1300, 650)
		case 2:
			return reed(55, 1100, 600)
		case 3:
			return reed(45, 800, 500)
		case 4:
			return sustained(
				65,
				formants(65, 18, [
					[1200, 250],
					[2800, 400]
				]),
				{
					attack: 0.05,
					breath: 0.03,
					seed
				}
			)
		case 5:
			return reed(57, 900, 350, 0.06)
		case 6:
			return reed(46, 600, 350, 0.06)
		default:
			return sustained(
				62,
				oddHarmonics(10, (h) => 1 / h ** 0.9),
				{
					attack: 0.05,
					breath: 0.04,
					seed
				}
			)
	}
}

function pipeFamily(program: number, seed: number): Voice {
	const flute = (base: number, second: number, breath: number, attack = 0.05) =>
		sustained(
			base,
			[
				{ ratio: 1, amp: 1 },
				{ ratio: 2, amp: second },
				{ ratio: 3, amp: second * 0.25 }
			],
			{ attack, breath, seed }
		)
	switch (program) {
		case 0:
			return flute(84, 0.15, 0.05)
		case 1:
			return flute(72, 0.2, 0.08)
		case 2:
			return flute(72, 0.08, 0.03, 0.03)
		case 3:
			return flute(72, 0.03, 0.14, 0.07)
		case 4:
			return flute(65, 0.05, 0.12, 0.06)
		case 5:
			return flute(69, 0.1, 0.2, 0.08)
		case 6:
			return flute(84, 0, 0.01, 0.06)
		default:
			return flute(72, 0.02, 0.02)
	}
}

function leadFamily(program: number, seed: number): Voice {
	const options = { attack: 0.01, seed }
	switch (program) {
		case 0:
			return sustained(
				60,
				oddHarmonics(14, (h) => 1 / h),
				options
			)
		case 1:
			return sustained(
				60,
				harmonicSeries(20, (h) => 1 / h),
				options
			)
		case 2:
			return sustained(
				60,
				[
					{ ratio: 1, amp: 1 },
					{ ratio: 2, amp: 0.45 },
					{ ratio: 3, amp: 0.15 }
				],
				{ ...options, attack: 0.03 }
			)
		case 3:
			return sustained(
				60,
				oddHarmonics(12, (h) => 1 / h),
				{ ...options, breath: 0.25 }
			)
		case 4:
			return sustained(
				60,
				harmonicSeries(20, (h) => 1 / h),
				{ ...options, drive: 4 }
			)
		case 5:
			return sustained(
				60,
				formants(60, 24, [
					[700, 200],
					[1100, 250]
				]),
				{ ...options, attack: 0.05 }
			)
		case 6:
			return sustained(
				60,
				[
					...harmonicSeries(16, (h) => 1 / h),
					...harmonicSeries(10, (h) => 0.6 / h).map((p) => ({
						...p,
						ratio: p.ratio * 1.5
					}))
				],
				options
			)
		default:
			return sustained(
				60,
				[
					...harmonicSeries(18, (h) => 1 / h),
					...harmonicSeries(8, (h) => 0.8 / h).map((p) => ({
						...p,
						ratio: p.ratio * 0.5
					}))
				],
				options
			)
	}
}

function padFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return sustained(
				60,
				harmonicSeries(6, (h) => 1 / h ** 1.4),
				{ attack: 0.5, seed }
			)
		case 1:
			return sustained(
				60,
				harmonicSeries(10, (h) => Math.exp(-h / 3) / h ** 0.5),
				{ attack: 0.35, seed }
			)
		case 2:
			return sustained(
				60,
				harmonicSeries(20, (h) => 1 / h),
				{ attack: 0.15, bright: 2, seed }
			)
		case 3:
			return sustained(
				60,
				formants(60, 24, [
					[600, 250],
					[1000, 300]
				]),
				{ attack: 0.4, seed }
			)
		case 4:
			return sustained(
				60,
				harmonicSeries(14, (h) => 1 / h ** 0.9),
				{ attack: 0.4, bright: 4, breath: 0.03, seed }
			)
		case 5:
			return sustained(
				60,
				[1, 2.5, 4, 5.5, 7.5].map((ratio, i) => ({ ratio, amp: 1 / (1 + i * 0.4) })),
				{ attack: 0.3, seed }
			)
		case 6:
			return sustained(
				60,
				[
					...harmonicSeries(5, (h) => 1 / h),
					{ ratio: 8, amp: 0.4 },
					{ ratio: 12, amp: 0.3 }
				],
				{
					attack: 0.5,
					seed
				}
			)
		default:
			return sustained(
				60,
				harmonicSeries(24, (h) => 1 / h ** 0.8),
				{ attack: 0.8, bright: 6, seed }
			)
	}
}

function fxFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return noiseLoop(2, 40, { length: 0.5, seed })
		case 1:
			return sustained(
				48,
				[1, 1.5, 2, 3, 4.5].map((ratio, i) => ({ ratio, amp: 1 / (1 + i * 0.5) })),
				{
					attack: 0.6,
					seed
				}
			)
		case 2:
			return decaying(72, bell([2, 3, 4, 6], [1, 2.4, 3.1, 4.7, 6.3]), { length: 1.6, seed })
		case 3:
			return sustained(
				60,
				harmonicSeries(8, (h) => 1 / h ** 1.2),
				{ attack: 0.5, bright: 2, seed }
			)
		case 4:
			return sustained(
				60,
				harmonicSeries(24, (h) => 1 / h ** 0.7),
				{ attack: 0.2, bright: 5, seed }
			)
		case 5:
			return sustained(
				36,
				[1, 1.5, 2.5, 3.5].map((ratio) => ({ ratio, amp: 1 / ratio })),
				{
					attack: 0.3,
					drive: 2,
					seed
				}
			)
		case 6: {
			const echoes = decaying(72, bell([6, 9], [1, 2.01]), { length: 1.6, seed })
			const delayed = new Float32Array(echoes.data.length)
			for (let repeat = 0; repeat < 5; repeat++) {
				const offset = seconds(0.22 * repeat)
				for (let i = 0; i + offset < delayed.length; i++) {
					delayed[i + offset] += echoes.data[i] * 0.6 ** repeat
				}
			}
			return { ...echoes, data: delayed }
		}
		default:
			return sustained(
				60,
				[1, 2.5, 3.5, 5, 6.5, 9].map((ratio, i) => ({ ratio, amp: 1 / (1 + i * 0.5) })),
				{
					attack: 0.1,
					bright: 2,
					seed
				}
			)
	}
}

function ethnicFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return pluck(55, { length: 1.8, bright: 1, sustain: 1.8, drive: 3.5, seed })
		case 1:
			return pluck(60, { length: 0.9, bright: 1, sustain: 0.7, seed })
		case 2:
			return pluck(55, { length: 1, bright: 0.85, sustain: 0.9, drive: 1.5, seed })
		case 3:
			return pluck(55, { length: 1.5, bright: 0.65, sustain: 1.3, seed })
		case 4:
			return decaying(72, bell([3, 9, 20], [1, 5.4, 6.27]), { length: 1, noise: 0.15, seed })
		case 5:
			return sustained(
				55,
				[...harmonicSeries(18, (h) => 1 / h ** 0.7), { ratio: 0.5, amp: 0.7 }],
				{ attack: 0.06, drive: 1.5, seed }
			)
		case 6:
			return sustained(67, formants(67, 20, [[1600, 500]]), {
				attack: 0.06,
				bright: 3,
				breath: 0.02,
				seed
			})
		default:
			return sustained(
				65,
				formants(65, 22, [
					[1500, 280],
					[2900, 400]
				]),
				{ attack: 0.05, breath: 0.04, seed }
			)
	}
}

function percussiveFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0:
			return decaying(84, bell([5, 8, 14], [1, 2.76, 5.4]), { length: 0.9, seed })
		case 1:
			return decaying(76, bell([7, 10], [1, 1.47, 2.09]), { length: 0.6, noise: 0.15, seed })
		case 2:
			return decaying(
				60,
				[
					{ ratio: 1, amp: 1, decay: 3.2 },
					{ ratio: 2, amp: 0.7, decay: 4.5 },
					{ ratio: 3.01, amp: 0.4, decay: 6 }
				],
				{ length: 1.1, noise: 0.1, seed }
			)
		case 3:
			return decaying(
				79,
				[
					{ ratio: 1, amp: 1, decay: 45 },
					{ ratio: 2.4, amp: 0.4, decay: 70 }
				],
				{
					length: 0.2,
					noise: 0.3,
					noiseDecay: 400,
					seed
				}
			)
		case 4:
		case 5:
		case 6:
			return sweptTone(program === 4 ? 48 : program === 5 ? 55 : 43, {
				length: program === 4 ? 0.9 : 0.5,
				start: program === 6 ? 3 : 1.5,
				sweepTime: 0.06,
				decay: program === 4 ? 4 : 7,
				noise: 0.15,
				seed
			})
		default: {
			const length = seconds(1)
			const noise = noiseSource(seed)
			const data = new Float32Array(length)
			for (let i = 0; i < length; i++) {
				data[i] = noise() * (i / length) ** 3
			}
			return { data: highpass(data, 1500), base: 60 }
		}
	}
}

function soundEffectFamily(program: number, seed: number): Voice {
	switch (program) {
		case 0: {
			const noise = noiseSource(seed)
			const data = new Float32Array(seconds(0.12))
			for (let i = 0; i < data.length; i++) {
				data[i] = noise() * Math.exp((-40 * i) / TIMBRE_RATE)
			}
			return { data: highpass(data, 2500), base: 60 }
		}
		case 1:
			return noiseLoop(8, 80, { length: 0.4, seed, modulation: 2 })
		case 2:
			return noiseLoop(1, 14, { length: 0.5, seed })
		case 3: {
			const data = new Float32Array(seconds(0.45))
			let phase = 0
			for (let i = 0; i < data.length; i++) {
				const t = i / TIMBRE_RATE
				const chirp = (t % 0.15) / 0.15
				phase += (2 * Math.PI * (2200 + 1800 * chirp ** 0.7)) / TIMBRE_RATE
				data[i] = Math.sin(phase) * Math.sin(Math.PI * chirp) * (t < 0.3 ? 1 : 0.4)
			}
			return { data, base: 96 }
		}
		case 4:
			// The 440 + 480 Hz ring tone, tuned to A4
			return sustained(
				69,
				[
					{ ratio: 1, amp: 1 },
					{ ratio: 480 / 440, amp: 1 }
				],
				{ attack: 0.01, seed }
			)
		case 5:
			return noiseLoop(3, 30, { length: 0.5, seed, modulation: 12 })
		case 6:
			return noiseLoop(10, 200, { length: 0.5, seed })
		default: {
			const noise = noiseSource(seed)
			const data = new Float32Array(seconds(0.5))
			for (let i = 0; i < data.length; i++) {
				data[i] = noise() * Math.exp((-12 * i) / TIMBRE_RATE)
			}
			lowpass(data, 3000)
			for (let i = 0; i < data.length; i++) {
				data[i] +=
					0.8 *
					Math.sin(2 * Math.PI * 55 * (i / TIMBRE_RATE)) *
					Math.exp((-14 * i) / TIMBRE_RATE)
			}
			return { data, base: 60 }
		}
	}
}

/** Sine with a pitch that falls from `start` times the note to the note, used for toms and kicks */
function sweptTone(
	base: number,
	options: {
		length: number
		start: number
		sweepTime: number
		decay: number
		noise?: number
		seed: number
	}
): Voice {
	const f0 = midiFrequency(base)
	const total = seconds(options.length)
	const data = new Float32Array(total)
	const noise = noiseSource(options.seed)
	let phase = 0
	for (let i = 0; i < total; i++) {
		const t = i / TIMBRE_RATE
		const frequency = f0 * (1 + (options.start - 1) * Math.exp(-t / options.sweepTime))
		phase += (2 * Math.PI * frequency) / TIMBRE_RATE
		data[i] =
			Math.sin(phase) * Math.exp(-options.decay * t) +
			(options.noise ?? 0) * noise() * Math.exp(-120 * t)
	}
	return { data, base }
}

/** Inharmonic square partials, the classic metallic cymbal and hi-hat recipe */
const METAL_FREQUENCIES = [205.3, 304.4, 369.6, 522.7, 540, 800]

function metallic(options: {
	length: number
	decay: number
	scale: number
	noise: number
	seed: number
	cutoff: number
}): Float32Array {
	const total = seconds(options.length)
	const data = new Float32Array(total)
	const noise = noiseSource(options.seed)
	for (let i = 0; i < total; i++) {
		const t = i / TIMBRE_RATE
		let sum = 0
		for (const frequency of METAL_FREQUENCIES) {
			sum += Math.sin(2 * Math.PI * frequency * options.scale * t) > 0 ? 1 : -1
		}
		data[i] = (sum / 6 + options.noise * noise()) * Math.exp(-options.decay * t)
	}
	return highpass(data, options.cutoff)
}

/** Short noise burst, high-passed, for hats, shakers and scrapes */
function noiseBurst(length: number, decay: number, cutoff: number, seed: number): Float32Array {
	const noise = noiseSource(seed)
	const data = new Float32Array(seconds(length))
	for (let i = 0; i < data.length; i++) {
		data[i] = noise() * Math.exp((-decay * i) / TIMBRE_RATE)
	}
	return highpass(data, cutoff)
}

const ping = (frequency: number, decay: number, length: number): Float32Array => {
	const data = new Float32Array(seconds(length))
	for (let i = 0; i < data.length; i++) {
		data[i] =
			Math.sin((2 * Math.PI * frequency * i) / TIMBRE_RATE) *
			Math.exp((-decay * i) / TIMBRE_RATE)
	}
	return data
}

const mix = (length: number, ...layers: [Float32Array, number, number?][]): Float32Array => {
	const data = new Float32Array(seconds(length))
	for (const [layer, gain, offset = 0] of layers) {
		const start = seconds(offset)
		for (let i = 0; i < layer.length && i + start < data.length; i++) {
			data[i + start] += layer[i] * gain
		}
	}
	return data
}

export const DRUM_NAMES: readonly [number, number, string][] = [
	[35, 36, "Kick"],
	[37, 37, "Side stick"],
	[38, 40, "Snare"],
	[39, 39, "Clap"],
	[41, 50, "Tom"],
	[42, 42, "Closed hat"],
	[44, 44, "Pedal hat"],
	[46, 46, "Open hat"],
	[49, 49, "Crash"],
	[57, 57, "Crash"],
	[51, 51, "Ride"],
	[59, 59, "Ride"],
	[52, 52, "China"],
	[53, 53, "Ride bell"],
	[55, 55, "Splash"],
	[54, 54, "Tambourine"],
	[56, 56, "Cowbell"],
	[58, 58, "Vibraslap"],
	[60, 61, "Bongo"],
	[62, 64, "Conga"],
	[65, 66, "Timbale"],
	[67, 68, "Agogo"],
	[69, 70, "Shaker"],
	[71, 72, "Whistle"],
	[73, 74, "Guiro"],
	[75, 77, "Block"],
	[78, 79, "Cuica"],
	[80, 81, "Triangle"],
	[82, 85, "Jingle"],
	[86, 87, "Surdo"]
]

export const drumName = (number: number) =>
	DRUM_NAMES.find(([low, high]) => number >= low && number <= high)?.[2] ?? "Drum"

/** One General MIDI percussion key as a short one-shot, the key selecting the sound */
function drumVoice(number: number, seed: number): Voice {
	const base = number
	let data: Float32Array
	if (number === 35 || number === 36) {
		data = sweptTone(36, {
			length: 0.45,
			start: 3.2,
			sweepTime: 0.035,
			decay: number === 35 ? 8 : 9,
			noise: 0.4,
			seed
		}).data
	} else if (number === 38 || number === 40) {
		data = mix(
			0.3,
			[ping(190, 24, 0.3), 0.5],
			[noiseBurst(0.3, number === 38 ? 16 : 22, 1200, seed), 0.9]
		)
	} else if (number === 37) {
		data = mix(0.1, [ping(1250, 90, 0.1), 0.7], [noiseBurst(0.04, 150, 2000, seed), 0.5])
	} else if (number === 39) {
		data = mix(
			0.3,
			...[0, 0.011, 0.022, 0.034].map((offset, i): [Float32Array, number, number] => [
				noiseBurst(i === 3 ? 0.28 : 0.03, i === 3 ? 14 : 120, 900, seed + i),
				0.8,
				offset
			])
		)
	} else if (number === 42 || number === 44 || number === 46) {
		const [length, decay] = number === 42 ? [0.12, 55] : number === 44 ? [0.16, 38] : [0.6, 7]
		data = metallic({ length, decay, scale: 1, noise: 0.5, seed, cutoff: 6000 })
	} else if ([41, 43, 45, 47, 48, 50].includes(number)) {
		data = sweptTone(43 + (number - 41) * 1.6, {
			length: 0.55,
			start: 1.6,
			sweepTime: 0.05,
			decay: 7,
			noise: 0.3,
			seed
		}).data
	} else if (number === 49 || number === 57) {
		data = metallic({ length: 1.4, decay: 3.2, scale: 1.3, noise: 0.6, seed, cutoff: 3500 })
	} else if (number === 51 || number === 59) {
		data = metallic({ length: 1, decay: 4, scale: 1.6, noise: 0.25, seed, cutoff: 4500 })
	} else if (number === 52) {
		data = metallic({ length: 1, decay: 4.5, scale: 2.1, noise: 0.5, seed, cutoff: 3000 })
	} else if (number === 53) {
		data = mix(
			0.8,
			[ping(1180, 5, 0.8), 0.6],
			[ping(2780, 9, 0.8), 0.4],
			[noiseBurst(0.05, 80, 5000, seed), 0.3]
		)
	} else if (number === 55) {
		data = metallic({ length: 0.6, decay: 7, scale: 1.8, noise: 0.5, seed, cutoff: 4000 })
	} else if (number === 54) {
		data = mix(0.25, [noiseBurst(0.25, 18, 6000, seed), 0.7], [ping(5200, 40, 0.1), 0.3])
	} else if (number === 56) {
		data = mix(0.35, [squarePing(562, 11, 0.35), 0.5], [squarePing(845, 11, 0.35), 0.5])
	} else if (number === 58) {
		const rattle = noiseBurst(0.5, 6, 800, seed)
		for (let i = 0; i < rattle.length; i++) {
			rattle[i] *= 0.6 + 0.4 * Math.sin((2 * Math.PI * 60 * i) / TIMBRE_RATE)
		}
		data = rattle
	} else if (number >= 60 && number <= 64) {
		const frequency = [330, 250, 300, 220, 180][number - 60]
		data = sweptTone(Math.round(69 + 12 * Math.log2(frequency / 440)), {
			length: 0.25,
			start: 1.2,
			sweepTime: 0.02,
			decay: 18,
			noise: 0.3,
			seed
		}).data
	} else if (number === 65 || number === 66) {
		data = mix(
			0.3,
			[ping(number === 65 ? 430 : 350, 14, 0.3), 0.7],
			[noiseBurst(0.04, 150, 1500, seed), 0.5]
		)
	} else if (number === 67 || number === 68) {
		const frequency = number === 67 ? 900 : 680
		data = mix(0.4, [ping(frequency, 10, 0.4), 0.6], [ping(frequency * 1.505, 12, 0.4), 0.4])
	} else if (number === 69 || number === 70) {
		data = noiseBurst(number === 69 ? 0.12 : 0.08, number === 69 ? 30 : 45, 5000, seed)
	} else if (number === 71 || number === 72) {
		const length = number === 71 ? 0.15 : 0.6
		data = new Float32Array(seconds(length))
		for (let i = 0; i < data.length; i++) {
			const t = i / TIMBRE_RATE
			data[i] =
				Math.sin(2 * Math.PI * 2400 * t + 3 * Math.sin(2 * Math.PI * 25 * t)) *
				Math.min(1, t * 80) *
				(1 - t / length)
		}
	} else if (number === 73 || number === 74) {
		const scrape = noiseBurst(number === 73 ? 0.14 : 0.45, 5, 1800, seed)
		for (let i = 0; i < scrape.length; i++) {
			scrape[i] *= 0.5 + 0.5 * Math.sin((2 * Math.PI * 38 * i) / TIMBRE_RATE)
		}
		data = scrape
	} else if (number >= 75 && number <= 77) {
		data = mix(0.12, [
			ping([2500, 880, 660][number - 75], [60, 40, 40][number - 75], 0.12),
			0.9
		])
	} else if (number === 78 || number === 79) {
		data = new Float32Array(seconds(0.3))
		let phase = 0
		for (let i = 0; i < data.length; i++) {
			const t = i / TIMBRE_RATE
			phase +=
				(2 *
					Math.PI *
					((number === 78 ? 180 : 320) + 120 * Math.sin((Math.PI * t) / 0.3))) /
				TIMBRE_RATE
			data[i] = Math.sin(phase + 2 * Math.sin(phase * 1.5)) * (1 - t / 0.3)
		}
	} else if (number === 80 || number === 81) {
		const decay = number === 80 ? 40 : 4
		data = mix(
			0.9,
			[ping(3150, decay, 0.9), 0.6],
			[ping(6300, decay * 1.4, 0.9), 0.3],
			[ping(9450, decay * 2, 0.9), 0.15]
		)
	} else if (number >= 82 && number <= 85) {
		data =
			number === 82
				? noiseBurst(0.12, 35, 5500, seed)
				: number === 83
					? mix(0.4, [noiseBurst(0.4, 10, 6500, seed), 0.6], [ping(4200, 12, 0.4), 0.4])
					: number === 84
						? mix(
								0.8,
								...[0, 0.05, 0.1, 0.15, 0.2].map(
									(offset, i): [Float32Array, number, number] => [
										ping(2000 + i * 600, 7, 0.6),
										0.5,
										offset
									]
								)
							)
						: mix(0.06, [noiseBurst(0.06, 90, 1800, seed), 0.9])
	} else if (number === 86 || number === 87) {
		data = sweptTone(33, {
			length: 0.6,
			start: 1.4,
			sweepTime: 0.04,
			decay: number === 86 ? 6 : 12,
			noise: 0.15,
			seed
		}).data
	} else {
		data = mix(
			0.08,
			[noiseBurst(0.08, 60, 800 + number * 20, seed), 0.7],
			[ping(300 + number * 12, 50, 0.08), 0.4]
		)
	}
	return { data, base }
}

const squarePing = (frequency: number, decay: number, length: number): Float32Array => {
	const data = new Float32Array(seconds(length))
	for (let i = 0; i < data.length; i++) {
		const phase = (frequency * i) / TIMBRE_RATE
		data[i] = (phase % 1 < 0.5 ? 1 : -1) * Math.exp((-decay * i) / TIMBRE_RATE)
	}
	return lowpass(data, 4000)
}

const FAMILY_VOICES = [
	pianoFamily,
	chromaticFamily,
	organFamily,
	guitarFamily,
	bassFamily,
	stringFamily,
	ensembleFamily,
	brassFamily,
	reedFamily,
	pipeFamily,
	leadFamily,
	padFamily,
	fxFamily,
	ethnicFamily,
	percussiveFamily,
	soundEffectFamily
] as const

const rms = (data: Float32Array, frames: number) => {
	let sum = 0
	const count = Math.min(frames, data.length)
	for (let i = 0; i < count; i++) {
		sum += data[i] * data[i]
	}
	return Math.sqrt(sum / Math.max(1, count))
}

/** Scale to a peak of 1, fade the end of one-shots to zero, and balance loudness between families */
function finalise(voice: Voice, name: string): TrackerSample {
	const data = voice.data
	let peak = 0
	for (let i = 0; i < data.length; i++) {
		peak = Math.max(peak, Math.abs(data[i]))
	}
	const scale = peak > 0 ? 1 / peak : 1
	for (let i = 0; i < data.length; i++) {
		data[i] *= scale
	}
	if (voice.loopLength === undefined) {
		const fade = Math.min(data.length, seconds(0.01))
		for (let i = 0; i < fade; i++) {
			data[data.length - 1 - i] *= i / fade
		}
	}
	const level = rms(data, seconds(0.5))
	return {
		name,
		data,
		sampleRate: TIMBRE_RATE,
		baseNote: voice.base,
		...(voice.loopLength === undefined
			? {}
			: { loopStart: voice.loopStart ?? 0, loopLength: voice.loopLength }),
		volume: level > 0 ? Math.max(0.35, Math.min(1, TARGET_RMS / level)) : 1
	}
}

/** General MIDI approximation of an instrument.
 * Channel 10 is the percussion channel: `number` selects the drum sound, and the sample's
 * baseNote is that key so playing the key plays the drum at its natural pitch.
 */
export function synthesiseTrackerSample(note: {
	channel: number
	patch: number
	number?: number
}): TrackerSample {
	if (note.channel === 10) {
		const number = Math.max(0, Math.min(127, Math.round(note.number ?? 36)))
		return finalise(drumVoice(number, 1000 + number), `${drumName(number)} ${number}`)
	}
	const program = Math.max(0, Math.min(127, Math.round(note.patch)))
	const family = program >> 3
	const voice = FAMILY_VOICES[family](program & 7, 7 + program * 31)
	return finalise(voice, `${GM_FAMILIES[family]} ${program + 1}`)
}