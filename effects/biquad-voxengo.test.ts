import { describe, expect, it, vi } from "vitest"
import {
	BT_PEQ,
	BT_BPF,
	cookBiquadVoxengo,
	createVoxengoBiquadFilter,
	type BiquadCoefficients,
	type VoxengoBiquadType
} from "./biquad-voxengo.ts"

function magnitude(c: BiquadCoefficients, frequency: number, sampleRate = 48000) {
	const omega = (2 * Math.PI * frequency) / sampleRate
	const real = (c0: number, c1: number, c2: number) =>
		c0 + c1 * Math.cos(omega) + c2 * Math.cos(2 * omega)
	const imaginary = (c1: number, c2: number) => -c1 * Math.sin(omega) - c2 * Math.sin(2 * omega)
	return (
		Math.hypot(real(c.b0, c.b1, c.b2), imaginary(c.b1, c.b2)) /
		Math.hypot(real(c.a0, c.a1, c.a2), imaginary(c.a1, c.a2))
	)
}

describe("Voxengo biquad design", () => {
	it("returns an exact identity at unity peaking gain", () => {
		expect(cookBiquadVoxengo(BT_PEQ, 48000, 8000, 1, 1)).toEqual({
			a0: 1,
			a1: 0,
			a2: 0,
			b0: 1,
			b1: 0,
			b2: 0
		})
	})

	for (const sampleRate of [44100, 48000, 96000]) {
		for (const normalizedFrequency of [0.001, 0.1, 0.4, 0.49]) {
			for (const bandwidth of [0.1, 1, 4]) {
				it(`meets gain and bandwidth anchors at ${sampleRate} Hz, f/fs=${normalizedFrequency}, BW=${bandwidth}`, () => {
					const frequency = sampleRate * normalizedFrequency
					for (const type of [BT_PEQ, BT_BPF]) {
						for (const gain of [0.01, 0.25, 2, 4]) {
							const c = cookBiquadVoxengo(
								type,
								sampleRate,
								frequency,
								gain,
								bandwidth
							)
							expect(Object.values(c).every(Number.isFinite)).toBe(true)
							expect(magnitude(c, frequency, sampleRate)).toBeCloseTo(
								type === BT_PEQ ? gain : 1,
								6
							)
							expect(
								magnitude(c, frequency * 2 ** (-bandwidth / 2), sampleRate)
							).toBeCloseTo(type === BT_PEQ ? Math.sqrt(gain) : Math.SQRT1_2, 6)
							expect(magnitude(c, 0, sampleRate)).toBeCloseTo(
								type === BT_PEQ ? 1 : 0,
								6
							)
							// Jury conditions for both poles strictly inside the unit circle.
							expect(c.a0 + c.a1 + c.a2).toBeGreaterThan(0)
							expect(c.a0 - c.a1 + c.a2).toBeGreaterThan(0)
							expect(c.a0 - c.a2).toBeGreaterThan(0)
						}
					}
				})
			}
		}
	}

	it("ignores gain for band-pass filters", () => {
		expect(cookBiquadVoxengo(BT_BPF, 48000, 8000, NaN, 1)).toEqual(
			cookBiquadVoxengo(BT_BPF, 48000, 8000, 1, 1)
		)
	})

	it("uses the upstream frequency clamps", () => {
		for (const type of [BT_PEQ, BT_BPF]) {
			expect(cookBiquadVoxengo(type, 48000, -100, 2, 1)).toEqual(
				cookBiquadVoxengo(type, 48000, 48000e-9, 2, 1)
			)
			expect(cookBiquadVoxengo(type, 48000, 48000, 2, 1)).toEqual(
				cookBiquadVoxengo(type, 48000, 48000 * 0.4999999, 2, 1)
			)
		}
	})

	it.each([
		[BT_PEQ, 0, 8000, 2, 1],
		[BT_PEQ, Infinity, 8000, 2, 1],
		[BT_PEQ, 48000, NaN, 2, 1],
		[BT_PEQ, 48000, 8000, 0, 1],
		[BT_PEQ, 48000, 8000, -1, 1],
		[BT_PEQ, 48000, 8000, Infinity, 1],
		[BT_PEQ, 48000, 8000, 2, 0],
		[BT_PEQ, 48000, 8000, 2, -1],
		[BT_PEQ, 48000, 8000, 2, NaN],
		[BT_BPF, 48000, 8000, 1, 10000],
		[9, 48000, 8000, 2, 1]
	])(
		"rejects invalid or numerically unsupported parameters: %j, %j, %j, %j, %j",
		(type, rate, frequency, gain, bandwidth) => {
			expect(() =>
				cookBiquadVoxengo(type as VoxengoBiquadType, rate, frequency, gain, bandwidth)
			).toThrow(RangeError)
		}
	)

	it("creates a Web Audio filter with normalized numerator and denominator in the correct order", () => {
		const node = {} as IIRFilterNode
		const createIIRFilter = vi.fn(() => node)
		const context = { sampleRate: 96000, createIIRFilter } as unknown as BaseAudioContext
		const c = cookBiquadVoxengo(BT_PEQ, 96000, 18000, 4, 1)
		expect(
			createVoxengoBiquadFilter(context, {
				type: BT_PEQ,
				frequency: 18000,
				gain: 4,
				bandwidth: 1
			})
		).toBe(node)
		expect(createIIRFilter).toHaveBeenCalledWith(
			[c.b0 / c.a0, c.b1 / c.a0, c.b2 / c.a0],
			[1, c.a1 / c.a0, c.a2 / c.a0]
		)
	})

	it("defaults to unity gain", () => {
		const createIIRFilter = vi.fn()
		const context = { sampleRate: 48000, createIIRFilter } as unknown as BaseAudioContext
		createVoxengoBiquadFilter(context, { type: BT_PEQ, frequency: 1000, bandwidth: 1 })
		expect(createIIRFilter).toHaveBeenCalledWith([1, 0, 0], [1, 0, 0])
	})
})