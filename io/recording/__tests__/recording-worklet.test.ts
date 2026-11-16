import { afterEach, expect, it, vi } from "vitest"
import {
	RECORDING_DATA,
	RECORDING_START,
	RECORDING_STOP
} from "../recording-format"

afterEach(() => {
	vi.unstubAllGlobals()
	vi.resetModules()
})

it("captures stereo, duplicates mono, includes silence and flushes partial batches on stop", async () => {
	let Processor: any
	vi.stubGlobal(
		"AudioWorkletProcessor",
		class {
			port = { onmessage: undefined as any, postMessage: vi.fn() }
		}
	)
	vi.stubGlobal("registerProcessor", (_name: string, processor: any) => {
		Processor = processor
	})
	await import("../recording.worklet.js")
	const processor = new Processor()
	processor.process([[new Float32Array([1]), new Float32Array([-1])]])
	processor.port.onmessage({ data: RECORDING_START })
	processor.process([[new Float32Array([0.5]), new Float32Array([-0.5])]])
	processor.process([[new Float32Array([0.25])]])
	processor.process([])
	processor.port.onmessage({ data: RECORDING_STOP })
	const [batch, done] = processor.port.postMessage.mock.calls
	expect(batch[0].type).toBe(RECORDING_DATA)
	expect([...batch[0].samples.subarray(0, 6)]).toEqual([0.5, -0.5, 0.25, 0.25, 0, 0])
	expect(batch[0].samples.length).toBe(260)
	expect(done[0].type).toBe(RECORDING_STOP)
})