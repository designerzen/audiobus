import { afterEach, describe, expect, it, vi } from "vitest"
import { SpectrumAnalyzer } from "../SpectrumAnalyzer.ts"
import { Visualiser } from "../visualisers/Visualiser.ts"
import { Scope } from "../visualisers/Scope.ts"

function setup(type = SpectrumAnalyzer.TYPE_FREQUENCY) {
	const frames = new Map<number, FrameRequestCallback>()
	let id = 0
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			frames.set(++id, callback)
			return id
		})
	)
	vi.stubGlobal(
		"cancelAnimationFrame",
		vi.fn((id: number) => frames.delete(id))
	)
	const node = {
		fftSize: 1024,
		get frequencyBinCount() {
			return this.fftSize / 2
		},
		getByteFrequencyData: vi.fn((data: Uint8Array) => data.fill(64)),
		getByteTimeDomainData: vi.fn((data: Uint8Array) => data.fill(128)),
		connect: vi.fn(),
		disconnect: vi.fn()
	}
	const context = { createAnalyser: () => node } as unknown as AudioContext
	const analyzer = new SpectrumAnalyzer(context, type)
	const tick = () => {
		const [key, callback] = [...frames.entries()][0]
		frames.delete(key)
		callback(1234)
	}
	return { analyzer, node, frames, tick }
}

afterEach(() => vi.unstubAllGlobals())
describe("SpectrumAnalyzer", () => {
	it("keeps one animation loop and cancels a queued frame immediately", () => {
		const { analyzer, frames, tick } = setup()
		analyzer.start()
		analyzer.start()
		expect(frames.size).toBe(1)
		tick()
		expect(frames.size).toBe(1)
		analyzer.stop()
		expect(frames.size).toBe(0)
		analyzer.start()
		expect(frames.size).toBe(1)
		analyzer.dispose()
		expect(frames.size).toBe(0)
		expect(() => analyzer.start()).toThrow("disposed")
	})
	it("updates each chain member once with its correct data domain and one timestamp", () => {
		const { analyzer, tick } = setup()
		const bars = new Visualiser("bars"),
			scope = new Scope()
		bars.update = vi.fn()
		scope.update = vi.fn()
		analyzer.append(bars)
		analyzer.append(scope)
		analyzer.start()
		tick()
		expect(bars.update).toHaveBeenCalledTimes(1)
		expect(scope.update).toHaveBeenCalledTimes(1)
		const frequency = vi.mocked(bars.update).mock.calls[0]
		const waveform = vi.mocked(scope.update).mock.calls[0]
		expect(frequency[0]).toHaveLength(512)
		expect(frequency[0][0]).toBe(64)
		expect(waveform[0]).toHaveLength(1024)
		expect(waveform[0][0]).toBe(128)
		expect(frequency[1]).toBe(waveform[1])
		analyzer.dispose()
	})
	it("allocates the entire FFT buffer for time-domain analysis and fidelity changes", () => {
		const { analyzer, node, tick } = setup(SpectrumAnalyzer.TYPE_TIME_DOMAIN)
		analyzer.setFidelity(2048)
		analyzer.start()
		tick()
		expect(analyzer.frequencyData).toHaveLength(2048)
		expect(node.getByteTimeDomainData).toHaveBeenCalledWith(analyzer.frequencyData)
		analyzer.dispose()
	})
	it("repairs endpoints and removes stale links when reordering and switching solo", () => {
		const { analyzer } = setup()
		const a = new Visualiser("a"),
			b = new Visualiser("b"),
			c = new Visualiser("c")
		analyzer.append(a)
		analyzer.append(b)
		analyzer.append(c)
		analyzer.append(a)
		expect(analyzer.head).toBe(b)
		expect(analyzer.tail).toBe(a)
		expect(c.next).toBe(a)
		expect(a.next).toBeUndefined()
		analyzer.solo(b)
		expect(analyzer.head).toBe(b)
		expect(analyzer.tail).toBe(b)
		expect(b.next).toBeUndefined()
		expect(b.previous).toBeUndefined()
		expect(a.next).toBeUndefined()
		expect(c.previous).toBeUndefined()
		analyzer.dispose()
	})
	it("observes audio silently and disconnects only its own source tap", () => {
		const { analyzer, node } = setup()
		const source = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode
		analyzer.observe(source)
		analyzer.observe(source)
		expect(source.connect).toHaveBeenCalledTimes(1)
		expect(node.connect).not.toHaveBeenCalled()
		analyzer.dispose()
		expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(node)
	})
	it("does not reschedule when an analysis callback stops rendering", () => {
		const { analyzer, frames, tick } = setup()
		analyzer.onanalysis = () => analyzer.stop()
		analyzer.start()
		tick()
		expect(frames.size).toBe(0)
	})
})