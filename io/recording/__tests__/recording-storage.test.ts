import { afterEach, expect, it, vi } from "vitest"
import {
	RECORDING_OPEN,
	RECORDING_DATA,
	RECORDING_STOP,
	RECORDING_EXPORT,
	RECORDING_RECOVER
} from "../recording-format"

afterEach(() => {
	vi.unstubAllGlobals()
	vi.resetModules()
})

it("writes progressively, recovers complete frames and overwrites the single take", async () => {
	let bytes = new Uint8Array(0)
	let fail = false
	const flush = vi.fn()
	const sync = {
		getSize: () => bytes.length,
		truncate: (size: number) => {
			bytes = bytes.slice(0, size)
		},
		flush,
		write: (data: Uint8Array, { at }: { at: number }) => {
			if (fail) {
				throw new Error("Quota exceeded")
			}
			const output = new Uint8Array(Math.max(bytes.length, at + data.length))
			output.set(bytes)
			output.set(data, at)
			bytes = output
			return data.length
		},
		read: (data: ArrayBufferView, { at }: { at: number }) => {
			const output = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			output.set(bytes.subarray(at, at + output.length))
			return output.length
		}
	}
	let exported: Uint8Array[] = []
	const destination = {
		createWritable: async () => {
			exported = []
			return {
				write: async (data: Uint8Array) => {
					exported.push(data.slice())
				},
				close: async () => {},
				abort: async () => {}
			}
		},
		getFile: async () => new Blob(exported)
	}
	const directory = {
		getFileHandle: async (name: string) =>
			name.endsWith(".raw") ? { createSyncAccessHandle: async () => sync } : destination,
		removeEntry: vi.fn().mockResolvedValue(undefined)
	}
	vi.stubGlobal("navigator", { storage: { getDirectory: async () => directory } })
	const replies: any[] = []
	const worker = { onmessage: undefined as any, postMessage: (data: any) => replies.push(data) }
	vi.stubGlobal("self", worker)
	await import("../recording-storage.worker")
	let id = 0
	const send = async (type: string, data = {}) => {
		const current = ++id
		worker.onmessage({ data: { id: current, type, ...data } })
		await vi.waitFor(() => expect(replies.some((reply) => reply.id === current)).toBe(true))
		return replies.find((reply) => reply.id === current)
	}
	await send(RECORDING_OPEN, { sampleRate: 44100 })
	await send(RECORDING_DATA, { samples: new Float32Array([0.5, -0.5, 1, -1]) })
	expect(bytes.length).toBe(20)
	expect((await send(RECORDING_STOP)).result.frames).toBe(2)
	const exportedFile = (await send(RECORDING_EXPORT, { bits: 16 })).result as Blob
	expect(exportedFile.size).toBe(88)
	const view = new DataView(await exportedFile.arrayBuffer())
	expect(view.getInt16(80, true)).toBe(16384)
	expect(view.getUint32(60, true)).toBe(44100)
	expect((await send(RECORDING_RECOVER)).result.frames).toBe(2)
	fail = true
	expect((await send(RECORDING_DATA, { samples: new Float32Array([1, 1]) })).error).toContain(
		"Quota exceeded"
	)
	expect((await send(RECORDING_STOP)).result.frames).toBe(2)
	fail = false
	await send(RECORDING_OPEN, { sampleRate: 48000 })
	await send(RECORDING_DATA, { samples: new Float32Array([0.25, -0.25]) })
	expect(bytes.length).toBe(12)
	expect((await send(RECORDING_RECOVER)).result).toEqual({ frames: 1, sampleRate: 48000 })
	expect(flush).toHaveBeenCalled()
})