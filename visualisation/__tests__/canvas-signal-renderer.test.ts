import { describe, expect, it, vi } from "vitest"
import { drawSpectrum, drawWaveform } from "../renderers/CanvasSignalRenderer.ts"

function context() {
	return {
		fillStyle: "purple",
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn()
	}
}
describe("shared canvas signal rendering", () => {
	it("renders the full waveform including both endpoints and the silent midline", () => {
		const ctx = context()
		drawWaveform(ctx as any, new Uint8Array([0, 128, 255]), 100, 255)
		expect(ctx.moveTo).toHaveBeenCalledWith(0, 0)
		expect(ctx.lineTo.mock.calls).toEqual([
			[50, 128],
			[100, 255]
		])
		expect(ctx.stroke).toHaveBeenCalledTimes(1)
	})
	it("aggregates peaks into disjoint spectrum bins without changing the caller's fill", () => {
		const ctx = context()
		drawSpectrum(ctx as any, new Uint8Array([0, 0, 255, 0, 0]), 100, 100, { bars: 2 })
		expect(ctx.fillRect.mock.calls).toEqual([
			[0, 100, 48, 0],
			[50, 0, 48, 100]
		])
		expect(ctx.fillStyle).toBe("purple")
	})
	it("supports logarithmic bands and peak decay without drawing empty input", () => {
		const ctx = context()
		const peaks = new Float32Array(2)
		const style = { bars: 2, minBin: 1, logarithmic: true, peaks }
		drawSpectrum(ctx as any, new Uint8Array([0, 255, 0, 0, 0]), 100, 100, style)
		expect(peaks[0]).toBe(1)
		drawSpectrum(ctx as any, new Uint8Array(5), 100, 100, style)
		expect(peaks[0]).toBeCloseTo(0.988)
		ctx.fillRect.mockClear()
		drawSpectrum(ctx as any, new Uint8Array(), 100, 100)
		expect(ctx.fillRect).not.toHaveBeenCalled()
		expect(ctx.fillStyle).toBe("purple")
	})
})