import { GENERAL_MIDI_INSTRUMENT_NAMES } from "../../midi/general-midi-instrument-constants"

export interface FMEnvelopeSettings {
	attack: number
	decay: number
	sustain: number
	release: number
}

export interface FMOperatorSettings {
	ratio: number
	gain: number
	envelope: FMEnvelopeSettings
	rates: number[]
	levels: number[]
	breakpoint: number
	leftDepth: number
	rightDepth: number
	leftCurve: number
	rightCurve: number
	rateScaling: number
	ampSensitivity: number
	velocitySensitivity: number
	output: number
	fixed: boolean
	coarse: number
	fine: number
	detune: number
	formant?: number
	fixedHz?: number
}

export interface FMNoiseSettings {
	gain: number
	low: number
	high: number
	envelope: FMEnvelopeSettings
}

export interface FMVoiceSettings {
	algorithm: number
	feedback: number
	sync: boolean
	transpose: number
	pitchRates: number[]
	pitchLevels: number[]
	lfoSpeed: number
	lfoDelay: number
	lfoWave: number
	lfoSync: boolean
	pitchDepth: number
	pitchSensitivity: number
	ampDepth: number
	operators: FMOperatorSettings[]
	gain: number
	noise?: FMNoiseSettings
	tremolo?: { rate: number; depth: number; square?: boolean }
	drive?: number
	pitchSweep?: { start: number; end: number; seconds: number }
}

export interface FMPatch extends FMVoiceSettings {
	program: number
	name: string
	bank: string
	levelTrim: number
	origin: string
}

// Fixed dB trims per General MIDI program: velocity 80, notes C3/C4/C5, loudest 100 ms
// over two seconds, targeting -26 dBFS RMS with an 18 dB boost ceiling.
export const FM_PROGRAM_TRIM_DB: readonly number[] = Object.freeze([
	1.45, 2.25, 1.57, 2.53, -0.06, -0.11, 3.57, 6.14, 1.42, 0.71, 1.94, 0.66, 3.59, 7.93, 0.26,
	1.77, -2.99, -2.72, -4.6, -4.7, -2.35, -4.72, -0.34, -2.19, 2.24, 0.65, 1.99, 0.85, 10, -8.13,
	-10.79, 1.48, 1.06, -1.76, -2.29, -1.98, -1.66, -2.38, -2.21, -2.16, -3.9, -4.48, -5.3, -5.39,
	-3.57, 8.52, 0.76, 2.16, -4.05, -3.35, -2.42, -5.93, -3.22, -1.94, -1.98, 1.52, -1.21, -1.93,
	-2.59, -1.11, -0.8, -1.95, -1.49, -4.67, 0.77, -0.28, -1.3, -2.29, -0.93, -1.93, -2.62, -1.8,
	0.24, 0.08, 0.09, 0.33, -0.14, -0.09, 0.46, 0.13, -5.02, -2.22, -2.77, 0.69, -5.8, -1.58, -1.64,
	-1.86, -3.8, -3.43, -1.65, -1.86, -3.74, -3.85, -4.63, -2.9, 18, -4.22, 0.57, -4.91, -4.41,
	-1.36, 3.41, -0.47, -0.26, 6.62, 7.18, 2.27, 4.28, 0.32, -3.61, 0.64, 1.04, 7.03, 2.11, 9.05,
	3.89, 6.05, 5.45, 8.21, 18, 10.26, 11.47, 9.29, -1.03, 14.51, 10.31, 4.9
])

// Original PhotoSYNTH voices. GM programs are zero-based.
// Three independent FM pairs provide a body, upper partials, and an attack/resonance.
// Envelopes use seconds; ratios and modulation indices describe the actual spectrum.
const env = (
	attack: number,
	decay: number,
	sustain: number,
	release: number
): FMEnvelopeSettings => ({ attack, decay, sustain, release })
const pluck = (decay = 1, release = 0.15) => env(0.002, decay, 0, release)
const held = (attack = 0.03, release = 0.15) => env(attack, 0.18, 0.85, release)
const operator = (
	ratio: number,
	gain: number,
	envelope: FMEnvelopeSettings,
	options: Partial<FMOperatorSettings> = {}
): FMOperatorSettings => ({
	ratio,
	gain,
	envelope,
	rates: [99, 70, 60, 70],
	levels: [99, 85, 70, 0],
	breakpoint: 48,
	leftDepth: 0,
	rightDepth: 8,
	leftCurve: 0,
	rightCurve: 0,
	rateScaling: 0,
	ampSensitivity: 0,
	velocitySensitivity: 2,
	output: 99,
	fixed: false,
	coarse: 1,
	fine: 0,
	detune: 0,
	...options
})
interface PairOptions {
	detune?: number
	carrier?: Partial<FMOperatorSettings>
	modulator?: Partial<FMOperatorSettings>
	modEnvelope?: FMEnvelopeSettings
}
const pair = (
	ratio: number,
	modRatio: number,
	index: number,
	gain: number,
	envelope: FMEnvelopeSettings,
	options: PairOptions = {}
) => [
	operator(ratio, gain, envelope, { detune: options.detune ?? 0, ...options.carrier }),
	operator(modRatio, index / 12, options.modEnvelope ?? envelope, {
		velocitySensitivity: 5,
		...options.modulator
	})
]
const voice = (
	pairs: FMOperatorSettings[][],
	options: Partial<FMVoiceSettings> = {}
): FMVoiceSettings => ({
	algorithm: 4,
	feedback: 0,
	sync: true,
	transpose: 0,
	pitchRates: [99, 99, 99, 99],
	pitchLevels: [50, 50, 50, 50],
	lfoSpeed: 63,
	lfoDelay: 12,
	lfoWave: 4,
	lfoSync: false,
	pitchDepth: 0,
	pitchSensitivity: 3,
	ampDepth: 0,
	operators: pairs.flat(),
	gain: 1,
	...options
})
const noise = (
	gain: number,
	low: number,
	high: number,
	envelope: FMEnvelopeSettings
): FMNoiseSettings => ({ gain, low, high, envelope })
const keys = ({
	bright = 1,
	decay = 2,
	detune = 0,
	metal = 0,
	tine = 0,
	gain = 1
}: {
	bright?: number
	decay?: number
	detune?: number
	metal?: number
	tine?: number
	gain?: number
} = {}) =>
	voice(
		[
			pair(1, 1, bright * 1.4, 1, pluck(decay, 0.22), {
				modEnvelope: pluck(decay * 0.3),
				carrier: { velocitySensitivity: 3 },
				modulator: { velocitySensitivity: 7 }
			}),
			pair(2, 1, bright * 0.65, 0.32, pluck(decay * 0.65, 0.18), { detune }),
			pair(
				tine ? 1 : 3,
				tine || 7,
				tine ? bright * 2.2 : 0.25,
				metal || 0.15,
				pluck(decay * 0.3, 0.12),
				{ detune: -detune }
			)
		],
		{ gain, noise: noise(0.015 * bright, 1800, 7000, pluck(0.025, 0.01)) }
	)
const bell = ({
	ratio = 3.5,
	index = 2,
	decay = 1.5,
	upper = 2,
	hardness = 0.3,
	tremolo = 0
}: {
	ratio?: number
	index?: number
	decay?: number
	upper?: number
	hardness?: number
	tremolo?: number
} = {}) =>
	voice(
		[
			pair(1, ratio, index, 1, pluck(decay, 0.35), { modEnvelope: pluck(decay * 0.45) }),
			pair(upper, upper * 1.01, 0.12, 0.3, pluck(decay * 0.6, 0.25), {
				carrier: { ampSensitivity: 3 }
			}),
			pair(4.1, 6.7, hardness, 0.15, pluck(0.04, 0.02))
		],
		{ ampDepth: tremolo }
	)
const organ = ({
	drawbars = [1, 2, 4],
	gains = [1, 0.6, 0.3],
	grit = 0.2,
	percussion = 0,
	rotary = 0
}: {
	drawbars?: number[]
	gains?: number[]
	grit?: number
	percussion?: number
	rotary?: number
} = {}) =>
	voice(
		[
			pair(drawbars[0], drawbars[0] * 2, grit, gains[0], held(0.008, 0.07), {
				carrier: { velocitySensitivity: 0, ampSensitivity: 2 }
			}),
			pair(drawbars[1], drawbars[1] * 2, grit * 0.5, gains[1], held(0.01, 0.08), {
				detune: 1,
				carrier: { velocitySensitivity: 0, ampSensitivity: 2 }
			}),
			pair(
				drawbars[2],
				drawbars[2],
				0.1,
				gains[2],
				percussion ? pluck(percussion, 0.05) : held(0.01, 0.1),
				{ carrier: { velocitySensitivity: 0 } }
			)
		],
		{ ampDepth: rotary, lfoSpeed: 61 }
	)
const guitar = ({
	bright = 1,
	decay = 1.1,
	body = 0.35,
	pick = 0.025,
	drive = 0,
	harmonic = 1
}: {
	bright?: number
	decay?: number
	body?: number
	pick?: number
	drive?: number
	harmonic?: number
} = {}) =>
	voice(
		[
			pair(harmonic, 1, bright * 1.5, 1, pluck(decay, 0.1), {
				modEnvelope: pluck(decay * 0.2)
			}),
			pair(harmonic * 2, 3, bright * 0.5, body, pluck(decay * 0.65, 0.1), { detune: 1 }),
			pair(harmonic * 3, 7, bright, 0.15, pluck(decay * 0.18, 0.06))
		],
		{ drive, noise: noise(pick, 1400, 8500, pluck(0.035, 0.02)) }
	)
const bass = ({
	index = 1.5,
	decay = 1,
	sustain = 0.12,
	attack = 0.003,
	slap = 0,
	bright = 0.2,
	detune = 0
}: {
	index?: number
	decay?: number
	sustain?: number
	attack?: number
	slap?: number
	bright?: number
	detune?: number
} = {}) =>
	voice(
		[
			pair(1, 1, index, 1, env(attack, decay, sustain, 0.1), {
				modEnvelope: env(0.001, decay * 0.2, 0.08, 0.05)
			}),
			pair(2, 1, index * 0.4, bright, env(attack, decay * 0.5, sustain * 0.6, 0.08), {
				detune
			}),
			pair(3, 7, slap * 5, slap, pluck(0.065, 0.035))
		],
		{ gain: 1.25, noise: noise(slap * 0.12, 1800, 8000, pluck(0.028, 0.01)) }
	)
const bowed = ({
	attack = 0.12,
	release = 0.3,
	bright = 1,
	detune = 0,
	vibrato = 3,
	tremolo = 0,
	body = 0.3
}: {
	attack?: number
	release?: number
	bright?: number
	detune?: number
	vibrato?: number
	tremolo?: number
	body?: number
} = {}) =>
	voice(
		[
			pair(1, 1, bright * 1.65, 1, held(attack, release), {
				detune: -detune,
				carrier: { ampSensitivity: 3 }
			}),
			pair(1, 2, bright * 0.85, 0.65, held(attack * 1.2, release), {
				detune,
				carrier: { ampSensitivity: 3 }
			}),
			pair(2, 3, bright * 0.5, body, held(attack * 1.5, release), {
				detune: detune * 0.4,
				carrier: { ampSensitivity: 3 }
			})
		],
		{
			pitchDepth: vibrato,
			ampDepth: tremolo,
			noise: noise(0.025, 1600, 6000, held(attack, release))
		}
	)
const choir = ({
	formants = [700, 1200, 2500],
	attack = 0.16,
	release = 0.5,
	breath = 0.04,
	vibrato = 2
}: {
	formants?: number[]
	attack?: number
	release?: number
	breath?: number
	vibrato?: number
} = {}) =>
	voice(
		formants.map((frequency, i) =>
			pair(1, 1, 0.55, [1, 0.7, 0.35][i], held(attack * (1 + i * 0.2), release), {
				detune: i - 1,
				carrier: { formant: frequency },
				modulator: { ratio: 1 }
			})
		),
		{ pitchDepth: vibrato, noise: noise(breath, 700, 6500, held(attack, release)) }
	)
const brass = ({
	bright = 1,
	attack = 0.045,
	body = 0.4,
	vibrato = 2,
	detune = 0
}: { bright?: number; attack?: number; body?: number; vibrato?: number; detune?: number } = {}) =>
	voice(
		[
			pair(1, 1, bright * 2.4, 1, held(attack, 0.16), {
				modEnvelope: env(attack * 1.8, 0.2, 0.72, 0.12),
				detune: -detune
			}),
			pair(2, 1, bright * 1.2, body, held(attack * 1.4, 0.14), { detune }),
			pair(3, 2, bright * 0.6, 0.15, held(attack * 1.6, 0.1))
		],
		{ pitchDepth: vibrato, noise: noise(0.015, 1400, 5000, held(attack, 0.12)) }
	)
const reed = ({
	ratio = 1,
	bright = 1,
	attack = 0.035,
	body = 0.35,
	vibrato = 3,
	breath = 0.035
}: {
	ratio?: number
	bright?: number
	attack?: number
	body?: number
	vibrato?: number
	breath?: number
} = {}) =>
	voice(
		[
			pair(1, ratio, bright * 1.8, 1, held(attack, 0.14)),
			pair(2, 2, bright * 0.7, body, held(attack * 1.2, 0.12), { detune: 1 }),
			pair(3, 2, bright * 0.35, 0.18, held(attack * 0.8, 0.1))
		],
		{ pitchDepth: vibrato, noise: noise(breath, 900, 5500, held(attack, 0.13)) }
	)
const flute = ({
	bright = 0.25,
	attack = 0.065,
	breath = 0.045,
	vibrato = 2,
	chiff = 0,
	upper = 0.12
}: {
	bright?: number
	attack?: number
	breath?: number
	vibrato?: number
	chiff?: number
	upper?: number
} = {}) =>
	voice(
		[
			pair(1, 1, bright, 1, held(attack, 0.16)),
			pair(2, 2, bright * 0.3, upper, held(attack * 1.2, 0.14)),
			pair(3, 5, chiff, 0.06, pluck(0.07, 0.04))
		],
		{ pitchDepth: vibrato, noise: noise(breath, 1800, 8000, held(attack, 0.1)) }
	)
const synth = ({
	ratio = 1,
	index = 2,
	attack = 0.008,
	release = 0.18,
	detune = 0,
	fifth = 1,
	sub = 1,
	motion = 0
}: {
	ratio?: number
	index?: number
	attack?: number
	release?: number
	detune?: number
	fifth?: number
	sub?: number
	motion?: number
} = {}) =>
	voice(
		[
			pair(sub, ratio, index, 1, held(attack, release), { detune: -detune }),
			pair(fifth, ratio * fifth, index * 0.65, 0.55, held(attack * 1.2, release), { detune }),
			pair(2, 2, index * 0.35, 0.25, held(attack * 0.8, release), { detune: detune * 0.5 })
		],
		{ pitchDepth: motion }
	)
const pad = ({
	ratio = 1,
	index = 1,
	attack = 0.7,
	release = 1.4,
	detune = 3,
	upper = 2,
	motion = 2,
	sweep = 0
}: {
	ratio?: number
	index?: number
	attack?: number
	release?: number
	detune?: number
	upper?: number
	motion?: number
	sweep?: number
} = {}) =>
	voice(
		[
			pair(1, ratio, index, 1, held(attack, release), {
				detune: -detune,
				modEnvelope: held(attack + sweep, release)
			}),
			pair(1, ratio, index * 0.6, 0.7, held(attack * 1.3, release * 1.2), { detune }),
			pair(upper, upper * ratio, index * 0.3, 0.3, held(attack * 1.5, release * 0.9), {
				detune: 1
			})
		],
		{ pitchDepth: motion }
	)
const drum = ({
	ratio = 1.4,
	index = 3,
	decay = 0.35,
	drop = 12,
	noiseGain = 0.1,
	high = 5000,
	ring = 0.2
}: {
	ratio?: number
	index?: number
	decay?: number
	drop?: number
	noiseGain?: number
	high?: number
	ring?: number
} = {}) =>
	voice(
		[
			pair(1, ratio, index, 1, pluck(decay, 0.12), { modEnvelope: pluck(decay * 0.22) }),
			pair(1.47, 2.09, index * 0.35, ring, pluck(decay * 0.55, 0.12)),
			pair(2.2, 3.7, 0.8, 0.15, pluck(decay * 0.25, 0.1))
		],
		{
			pitchSweep: { start: drop, end: 0, seconds: 0.07 },
			noise: noise(noiseGain, 150, high, pluck(decay * 0.35, 0.08))
		}
	)
const texture = ({
	gain = 0.2,
	low = 500,
	high = 7000,
	attack = 0.05,
	decay = 0.5,
	sustain = 0.8,
	release = 0.3,
	tone = 0.04,
	rate = 0,
	depth = 0
}: {
	gain?: number
	low?: number
	high?: number
	attack?: number
	decay?: number
	sustain?: number
	release?: number
	tone?: number
	rate?: number
	depth?: number
} = {}) =>
	voice(
		[
			pair(1, 1.414, 5, tone, env(attack, decay, sustain, release)),
			pair(2.71, 3.14, 4, tone * 0.4, env(attack, decay, sustain, release)),
			pair(5.1, 7.3, 3, tone * 0.2, env(attack, decay, sustain, release))
		],
		{
			noise: noise(gain, low, high, env(attack, decay, sustain, release)),
			tremolo: { rate, depth }
		}
	)

const recipes: FMVoiceSettings[] = [
	// Piano: hammer body, bright partials, detuned unisons, tines and reeds.
	keys({ bright: 0.85, decay: 2.8 }),
	keys({ bright: 1.6, decay: 2.1 }),
	keys({ bright: 1.15, decay: 2.6, metal: 0.24 }),
	keys({ bright: 1.25, decay: 1.8, detune: 5 }),
	keys({ bright: 0.65, decay: 2.9, tine: 14, metal: 0.32 }),
	keys({ bright: 0.9, decay: 2.4, tine: 3.5, metal: 0.5 }),
	guitar({ bright: 2.2, decay: 0.65, pick: 0.01, body: 0.55 }),
	guitar({ bright: 1.65, decay: 0.32, pick: 0.055, body: 0.65 }),
	// Chromatic percussion: inharmonic metal versus rapidly damped wood.
	bell({ ratio: 3.5, index: 1.3, decay: 2.1, upper: 4 }),
	bell({ ratio: 3.46, index: 2.4, decay: 3.2, upper: 6.8 }),
	bell({ ratio: 5.43, index: 1.5, decay: 1.65, upper: 3 }),
	bell({ ratio: 1, index: 0.4, decay: 3.6, upper: 4, tremolo: 28 }),
	bell({ ratio: 7, index: 0.45, decay: 0.9, upper: 4, hardness: 0.6 }),
	bell({ ratio: 3, index: 0.7, decay: 0.28, upper: 4, hardness: 1.7 }),
	bell({ ratio: 1.414, index: 3.1, decay: 4.6, upper: 2.76 }),
	guitar({ bright: 1.5, decay: 1.1, body: 0.55, pick: 0.01 }),
	// Organs: different registrations; percussion and rotating-speaker movement.
	organ({ drawbars: [0.5, 1, 3], gains: [0.65, 1, 0.28], rotary: 12 }),
	organ({ drawbars: [1, 2, 3], percussion: 0.22, rotary: 8 }),
	organ({ drawbars: [0.5, 1, 4], gains: [0.6, 1, 0.6], grit: 1.8, rotary: 18 }),
	organ({ drawbars: [0.5, 1, 4], gains: [1, 0.8, 0.5], grit: 0.65 }),
	reed({ ratio: 2, bright: 0.8, attack: 0.06, vibrato: 0, breath: 0.01 }),
	synth({ ratio: 2, index: 1.4, detune: 3, attack: 0.035 }),
	reed({ ratio: 2, bright: 1.6, attack: 0.02, vibrato: 5, breath: 0.025 }),
	synth({ ratio: 1, index: 1.5, detune: 1.7, attack: 0.04 }),
	// Guitars: nylon, steel, pickups, palm muting, saturation, isolated harmonics.
	guitar({ bright: 0.55, decay: 1.45, body: 0.22, pick: 0.018 }),
	guitar({ bright: 1.7, decay: 1.75, body: 0.5, pick: 0.05 }),
	guitar({ bright: 0.35, decay: 1.7, body: 0.16, pick: 0.008 }),
	guitar({ bright: 0.9, decay: 2, body: 0.4, pick: 0.025 }),
	guitar({ bright: 0.8, decay: 0.13, body: 0.22, pick: 0.07 }),
	guitar({ bright: 1.2, decay: 2.4, drive: 2.2, body: 0.55 }),
	guitar({ bright: 1.8, decay: 3.5, drive: 4, body: 0.7 }),
	guitar({ bright: 0.1, decay: 2.3, harmonic: 2, body: 0.1, pick: 0.003 }),
	// Basses: soft finger attacks, picked harmonics, fretless sustain and slap transients.
	bass({ index: 1.2, decay: 1.4, sustain: 0, bright: 0.15, attack: 0.012 }),
	bass({ index: 1.05, decay: 1.8, sustain: 0.12, bright: 0.25 }),
	bass({ index: 1.8, decay: 1.3, bright: 0.5, slap: 0.12 }),
	bass({ index: 0.75, attack: 0.025, decay: 2.3, sustain: 0.45, bright: 0.12 }),
	bass({ index: 2.2, decay: 0.75, slap: 0.7, bright: 0.45 }),
	bass({ index: 3.2, decay: 0.5, slap: 0.95, bright: 0.7 }),
	bass({ index: 3, decay: 0.8, sustain: 0.65, bright: 0.4 }),
	bass({ index: 1.9, decay: 0.35, sustain: 0.4, bright: 0.65, detune: 2 }),
	// Solo strings, tremolo, pizzicato, harp, and struck kettle drum.
	bowed({ bright: 1.2, attack: 0.09, vibrato: 4 }),
	bowed({ bright: 0.9, attack: 0.13, body: 0.4 }),
	bowed({ bright: 0.65, attack: 0.16, body: 0.55, vibrato: 2 }),
	bowed({ bright: 0.5, attack: 0.21, body: 0.65, vibrato: 1 }),
	bowed({ bright: 1, attack: 0.06, tremolo: 65, detune: 2 }),
	guitar({ bright: 0.45, decay: 0.27, body: 0.2, pick: 0.015 }),
	guitar({ bright: 0.5, decay: 2.6, body: 0.3, pick: 0.005 }),
	drum({ ratio: 1.5, index: 1.2, decay: 1.5, drop: 3, noiseGain: 0.045, ring: 0.35 }),
	// Ensembles and fixed-frequency vocal formant regions.
	bowed({ attack: 0.28, release: 0.6, detune: 3, bright: 0.8 }),
	bowed({ attack: 0.6, release: 0.9, detune: 4, bright: 0.65 }),
	pad({ attack: 0.19, release: 0.45, detune: 3, index: 1.8 }),
	pad({ attack: 0.4, release: 0.8, detune: 5, index: 1.1, ratio: 2 }),
	choir({ formants: [800, 1150, 2800], attack: 0.2 }),
	choir({ formants: [350, 800, 2200], attack: 0.16, breath: 0.02 }),
	choir({ formants: [500, 1500, 3000], attack: 0.07, vibrato: 4 }),
	voice(
		[
			pair(1, 1, 2.4, 1, pluck(0.65, 0.2)),
			pair(2, 2, 1.5, 0.7, pluck(0.5, 0.2)),
			pair(0.5, 1, 1, 0.7, pluck(0.8, 0.2))
		],
		{ noise: noise(0.09, 600, 6000, pluck(0.18, 0.1)) }
	),
	// Brass: increasing bore/body weight and a muted nasal spectrum.
	brass({ bright: 1.2, attack: 0.035 }),
	brass({ bright: 0.85, attack: 0.065, body: 0.6 }),
	brass({ bright: 0.45, attack: 0.09, body: 0.8, vibrato: 1 }),
	reed({ ratio: 2, bright: 1.3, body: 0.18, breath: 0.008 }),
	brass({ bright: 0.6, attack: 0.09, body: 0.45 }),
	brass({ bright: 1, attack: 0.06, detune: 2.5, body: 0.65 }),
	synth({ index: 2.6, attack: 0.04, detune: 1.5 }),
	synth({ ratio: 2, index: 2, attack: 0.09, detune: 2.2 }),
	// Reeds: sax buzz, narrow double reeds, hollow odd-harmonic clarinet.
	reed({ bright: 1.2, body: 0.25, vibrato: 4 }),
	reed({ bright: 1.1, body: 0.4, attack: 0.045 }),
	reed({ bright: 0.95, body: 0.55, attack: 0.055, breath: 0.045 }),
	reed({ bright: 0.8, body: 0.7, attack: 0.07, breath: 0.055 }),
	reed({ ratio: 2, bright: 1.35, body: 0.15, breath: 0.012 }),
	reed({ ratio: 2, bright: 1.05, body: 0.25, attack: 0.06, breath: 0.02 }),
	reed({ ratio: 2, bright: 0.75, body: 0.45, attack: 0.07, breath: 0.025 }),
	reed({ ratio: 2, bright: 0.9, body: 0.015, breath: 0.018 }),
	// Pipes: near-sine bodies with separately shaped breath and chiff.
	flute({ bright: 0.3, attack: 0.025, upper: 0.2, breath: 0.025 }),
	flute({ bright: 0.18, breath: 0.045 }),
	flute({ bright: 0.45, attack: 0.03, breath: 0.02, vibrato: 0, upper: 0.24 }),
	flute({ bright: 0.15, attack: 0.02, chiff: 1.4, breath: 0.09 }),
	flute({ bright: 0.06, attack: 0.1, breath: 0.1, upper: 0.02, vibrato: 0 }),
	flute({ bright: 0.6, attack: 0.12, chiff: 2, breath: 0.15, vibrato: 5 }),
	flute({ bright: 0.015, attack: 0.02, upper: 0.005, breath: 0.004, vibrato: 3 }),
	flute({ bright: 0.08, attack: 0.07, upper: 0.04, breath: 0.02, vibrato: 1 }),
	// Leads.
	synth({ ratio: 2, index: 2.3 }),
	synth({ ratio: 1, index: 2.8, detune: 1.2 }),
	organ({ drawbars: [1, 2, 3], gains: [1, 0.4, 0.22], grit: 0.4 }),
	flute({ bright: 1.1, chiff: 3, attack: 0.006, breath: 0.09 }),
	voice([pair(1, 1, 4, 1, held()), pair(2, 3, 3, 0.45, held()), pair(3, 7, 2, 0.2, pluck(0.1))], {
		drive: 1.2
	}),
	choir({ formants: [650, 1700, 2900], attack: 0.025, release: 0.2, breath: 0.005 }),
	synth({ ratio: 1, index: 1.8, fifth: 1.5, detune: 1 }),
	synth({ ratio: 1, index: 2.4, sub: 0.5, detune: 1.4 }),
	// Pads.
	pad({ ratio: 3.5, index: 0.55, upper: 4, attack: 0.45, release: 2 }),
	pad({ index: 0.55, attack: 0.9, release: 1.6 }),
	pad({ index: 2, attack: 0.22, release: 0.7, detune: 4 }),
	choir({ formants: [600, 1000, 2400], attack: 0.8, release: 1.8, breath: 0.02 }),
	bowed({ attack: 0.8, release: 1.3, detune: 3.5, bright: 0.6 }),
	pad({ ratio: 1.414, index: 2.8, upper: 2.76, attack: 0.5, release: 2.2 }),
	pad({ ratio: 2, index: 0.4, upper: 4, attack: 1, release: 2.5, motion: 3 }),
	pad({ index: 2.5, attack: 0.4, release: 1.8, sweep: 2 }),
	// Synth effects: rain, cinematic wash, crystals, airy ambience, shimmer, motion, echoes, sci-fi.
	texture({ gain: 0.16, low: 2000, attack: 0.3, tone: 0.08, rate: 17, depth: 0.75 }),
	pad({ ratio: 1.5, index: 1.7, attack: 1.1, release: 2.8, upper: 3 }),
	bell({ ratio: 5.19, index: 1.8, decay: 3.5, upper: 8 }),
	pad({ ratio: 2, index: 0.35, attack: 1.4, release: 3.2, upper: 3 }),
	pad({ ratio: 3, index: 1.4, attack: 0.3, release: 1.4, upper: 4 }),
	voice(
		[
			pair(1, 1.47, 3, 1, held(0.3, 0.8)),
			pair(2.01, 3.12, 2, 0.5, held(0.5, 1)),
			pair(0.5, 1, 1, 0.3, held())
		],
		{ pitchDepth: 20, lfoSpeed: 37, lfoWave: 0 }
	),
	voice(
		[
			pair(1, 3.5, 1.4, 1, pluck(2.4, 1)),
			pair(2, 5.1, 1, 0.4, pluck(2, 0.8)),
			pair(3, 7.1, 0.8, 0.2, pluck(1.8, 0.7))
		],
		{ tremolo: { rate: 4.5, depth: 0.85 } }
	),
	voice(
		[
			pair(1, 1.414, 4, 1, held(0.15, 1)),
			pair(2.71, 3.3, 3, 0.4, held(0.3, 1)),
			pair(0.5, 5, 2, 0.3, held())
		],
		{ pitchSweep: { start: -12, end: 12, seconds: 2 }, pitchDepth: 12, lfoSpeed: 45 }
	),
	// Ethnic strings and winds.
	guitar({ bright: 2.5, decay: 1.8, body: 0.65, pick: 0.065 }),
	guitar({ bright: 2, decay: 0.4, body: 0.3, pick: 0.085 }),
	guitar({ bright: 2.8, decay: 0.3, body: 0.4, pick: 0.12 }),
	guitar({ bright: 1.2, decay: 1.55, body: 0.2, pick: 0.04 }),
	bell({ ratio: 5, index: 0.5, decay: 0.75, upper: 3, hardness: 0.2 }),
	reed({ ratio: 2, bright: 1.8, attack: 0.02, vibrato: 0, breath: 0.01 }),
	bowed({ bright: 1.45, attack: 0.045, vibrato: 5, body: 0.4 }),
	reed({ ratio: 2, bright: 1.9, attack: 0.035, vibrato: 6, breath: 0.03 }),
	// Tuned percussion and reverse cymbal.
	bell({ ratio: 6.73, index: 3.5, decay: 2.6, upper: 9.1 }),
	bell({ ratio: 2.76, index: 1.7, decay: 0.38, upper: 4.1, hardness: 1.1 }),
	bell({ ratio: 2, index: 1.15, decay: 0.9, upper: 3, hardness: 0.8 }),
	drum({ ratio: 2.5, index: 0.5, decay: 0.075, drop: 0, noiseGain: 0.03, ring: 0.6 }),
	drum({ ratio: 1.3, index: 2.5, decay: 0.8, drop: 7, noiseGain: 0.12, ring: 0.35 }),
	drum({ ratio: 1.47, index: 1.8, decay: 0.5, drop: 9, noiseGain: 0.06 }),
	drum({ ratio: 1, index: 0.7, decay: 0.6, drop: 24, noiseGain: 0.015, ring: 0.05 }),
	texture({
		gain: 0.4,
		low: 2500,
		high: 10000,
		attack: 1.2,
		decay: 0.04,
		sustain: 0,
		release: 0.1,
		tone: 0.07
	}),
	// Sound effects: scraped strings, breath, waves, chirps, ringing, rotor, crowd, impact.
	texture({
		gain: 0.2,
		low: 1200,
		high: 6000,
		attack: 0.003,
		decay: 0.22,
		sustain: 0,
		release: 0.08,
		tone: 0.14,
		rate: 45,
		depth: 0.5
	}),
	texture({ gain: 0.24, low: 700, high: 6500, attack: 0.09, release: 0.2, tone: 0 }),
	texture({
		gain: 0.33,
		low: 120,
		high: 4200,
		attack: 1.4,
		release: 1.8,
		tone: 0,
		rate: 0.18,
		depth: 0.7
	}),
	voice(
		[
			pair(2, 3, 0.35, 1, pluck(0.3, 0.1)),
			pair(3, 4, 0.2, 0.1, pluck(0.18)),
			pair(4, 7, 0.1, 0.03, pluck(0.08))
		],
		{ pitchSweep: { start: 12, end: -5, seconds: 0.22 }, tremolo: { rate: 9, depth: 0.75 } }
	),
	voice(
		[
			pair(1, 1, 0, 0.8, held(0.002, 0.05), { carrier: { fixedHz: 440, rightDepth: 0 } }),
			pair(1, 1, 0, 0.8, held(0.002, 0.05), { carrier: { fixedHz: 480, rightDepth: 0 } }),
			pair(1, 1, 0, 0, held())
		],
		{ tremolo: { rate: 2, depth: 1, square: true } }
	),
	texture({
		gain: 0.38,
		low: 35,
		high: 850,
		attack: 0.3,
		release: 0.6,
		tone: 0.15,
		rate: 18,
		depth: 0.9
	}),
	texture({
		gain: 0.35,
		low: 700,
		high: 7500,
		attack: 0.06,
		release: 0.4,
		tone: 0,
		rate: 28,
		depth: 0.85
	}),
	drum({ ratio: 1.414, index: 8, decay: 0.2, drop: 30, noiseGain: 0.7, high: 10000, ring: 0.1 })
]

export const FM_GENERAL_MIDI_PRESETS: readonly FMPatch[] = recipes.map((patch, program) => ({
	...patch,
	program,
	name: GENERAL_MIDI_INSTRUMENT_NAMES[program],
	bank: "General MIDI",
	levelTrim: 10 ** (FM_PROGRAM_TRIM_DB[program] / 20),
	// Original synthesized approximations; no sampled or third-party patch content.
	origin: "PhotoSYNTH"
}))