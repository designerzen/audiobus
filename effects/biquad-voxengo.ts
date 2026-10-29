/**
 * TypeScript port of https://github.com/avaneev/biquad-voxengo
 * Copyright (c) 2026 Aleksey Vaneev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export const BT_PEQ = 0
export const BT_BPF = 1
export type VoxengoBiquadType = typeof BT_PEQ | typeof BT_BPF

export interface BiquadCoefficients {
	a0: number
	a1: number
	a2: number
	b0: number
	b1: number
	b2: number
}

export interface VoxengoBiquadOptions {
	type: VoxengoBiquadType
	frequency: number
	/** Linear amplitude, e.g. 2 for approximately +6 dB; ignored for band-pass. */
	gain?: number
	/** Bandwidth in octaves: 2 / ln(2) * asinh(1 / (2 * Q)). */
	bandwidth: number
}

/** Returns unnormalized coefficients, with b as numerator and a as denominator. */
export const cookBiquadVoxengo = (
	type: VoxengoBiquadType,
	sampleRate: number,
	frequency: number,
	gain: number,
	bandwidth: number
): BiquadCoefficients => {
	if (type !== BT_PEQ && type !== BT_BPF) {
		throw new RangeError("Unsupported Voxengo biquad type")
	}
	if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new RangeError("Sample rate must be finite and positive")
	}
	if (!Number.isFinite(frequency)) {
		throw new RangeError("Frequency must be finite")
	}
	if (!Number.isFinite(bandwidth) || bandwidth <= 0) {
		throw new RangeError("Bandwidth must be finite and positive")
	}
	if (type === BT_PEQ && (!Number.isFinite(gain) || gain <= 0)) {
		throw new RangeError("Peaking gain must be finite and positive")
	}

	const fp = Math.min(0.4999999, Math.max(1e-9, frequency / sampleRate))
	const fb = fp * Math.pow(0.5, bandwidth * 0.5)
	const r = (fp * fp - fb * fb) / (2 * fb * (0.25 - fp * fp))
	const y = r * r

	if (type === BT_PEQ && Math.abs(gain - 1) < 1e-9) {
		return { a0: 1, a1: 0, a2: 0, b0: 1, b1: 0, b2: 0 }
	}

	const gn = type === BT_PEQ ? (1 + gain * y) / (1 + y / gain) : y / (1 + y)
	const gb = type === BT_PEQ ? gain : 0.5
	const gp = type === BT_PEQ ? gain * gain : 1
	const v = type === BT_PEQ ? Math.sqrt(gain / (gain + y)) : 1 / Math.sqrt(1 + y)
	const xp = Math.tan(Math.PI * fp) ** 2
	const xb = Math.tan(Math.PI * fb) ** 2
	const w = xp * v
	const gc = Math.sqrt(gn)
	const g0 = type === BT_PEQ ? w : 0

	const r1 = (gp * (w - xp) ** 2 - (g0 - gc * xp) ** 2) / xp
	const r2 = (gb * (w - xb) ** 2 - (g0 - gc * xb) ** 2) / xb
	const den = gb - gp
	const a = Math.sqrt((r1 - r2) / den)
	const b = Math.sqrt((gb * r1 - gp * r2) / den)
	const coefficients = {
		a0: 1 + w + a,
		a1: 2 * (w - 1),
		a2: 1 + w - a,
		b0: gc + g0 + b,
		b1: 2 * (g0 - gc),
		b2: gc + g0 - b
	}
	if (!Object.values(coefficients).every(Number.isFinite)) {
		throw new RangeError("Parameters exceed the numerical range of the Voxengo design")
	}
	return coefficients
}

/** Creates a fixed filter; create a new node when changing its parameters. */
export const createVoxengoBiquadFilter = (
	context: BaseAudioContext,
	{ type, frequency, gain = 1, bandwidth }: VoxengoBiquadOptions
): IIRFilterNode => {
	const { a0, a1, a2, b0, b1, b2 } = cookBiquadVoxengo(
		type,
		context.sampleRate,
		frequency,
		gain,
		bandwidth
	)
	return context.createIIRFilter([b0 / a0, b1 / a0, b2 / a0], [1, a1 / a0, a2 / a0])
}