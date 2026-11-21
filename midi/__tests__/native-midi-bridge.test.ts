import { afterEach, expect, it, vi } from "vitest"
import {
	createEndpointMidiBridge,
	getNativeMidiBridge,
	hasNativeMidiBridge,
	type EndpointMidiBridge,
	type EndpointMidiPort
} from "../native-midi-bridge"

afterEach(() => vi.unstubAllGlobals())

const endpoints = (inputs: EndpointMidiPort[], outputs: EndpointMidiPort[]) => {
	const listeners = { message: [] as any[], ports: [] as any[] }
	const bridge = {
		available: true,
		ports: { inputs, outputs },
		getPorts: vi.fn(async () => bridge.ports),
		sendUMP: vi.fn(async () => true),
		onMessage: vi.fn((callback) => {
			listeners.message.push(callback)
			return () => {}
		}),
		onPortsChanged: vi.fn((callback) => {
			listeners.ports.push(callback)
			return () => {}
		}),
		message: (message: any) => listeners.message.forEach((callback) => callback(message)),
		change: (ports: any) => {
			bridge.ports = ports
			listeners.ports.forEach((callback) => callback(ports))
		}
	}
	return bridge
}

it("numbers endpoints, keeps a replugged device's number and sends to the right endpoint", async () => {
	const keys = { id: "ep-keys", name: "Keys" },
		synth = { id: "ep-synth", name: "Synth" },
		pads = { id: "ep-pads", name: "Pads" }
	const source = endpoints([keys], [synth, pads])
	const bridge = createEndpointMidiBridge(source as EndpointMidiBridge)
	expect(await bridge.getUmpInputs()).toEqual([{ index: 0, id: "ep-keys", name: "Keys" }])
	expect((await bridge.getUmpOutputs()).map((device) => device.index)).toEqual([0, 1])
	await bridge.openUmpOutput(1)
	await bridge.sendUmp(1, [0x20903c64])
	expect(source.sendUMP).toHaveBeenCalledWith("ep-pads", [0x20903c64])

	source.change({ inputs: [keys], outputs: [pads] })
	await expect(bridge.sendUmp(0, [0x20903c64])).rejects.toThrow("not connected")
	source.change({ inputs: [keys], outputs: [{ id: "ep-new", name: "New" }, synth, pads] })
	expect(await bridge.getUmpOutputs()).toEqual([
		{ index: 2, id: "ep-new", name: "New" },
		{ index: 0, id: "ep-synth", name: "Synth" },
		{ index: 1, id: "ep-pads", name: "Pads" }
	])
	await expect(bridge.openUmpInput(4)).rejects.toThrow("no MIDI port 4")
})

it("passes messages from known inputs on with their number and timestamp", async () => {
	const source = endpoints([{ id: "ep-keys", name: "Keys" }], [])
	const bridge = createEndpointMidiBridge(source as EndpointMidiBridge)
	const received = vi.fn()
	bridge.onUmpInput(received)
	await bridge.getUmpInputs()
	source.message({ endpointId: "ep-keys", timestamp: 12, words: [0x20903c64] })
	source.message({ endpointId: "ep-gone", timestamp: 13, words: [0x20903c64] })
	expect(received.mock.calls).toEqual([[0, [0x20903c64], 12]])
})

it("prefers electronAPI.midi2 and otherwise wraps an available electron.midi", () => {
	vi.stubGlobal("window", undefined)
	expect(hasNativeMidiBridge()).toBe(false)
	expect(() => getNativeMidiBridge()).toThrow("Electron")
	vi.stubGlobal("electron", { midi: { ...endpoints([], []), available: false } })
	expect(hasNativeMidiBridge()).toBe(false)
	const midi = endpoints([], [])
	vi.stubGlobal("electron", { midi })
	expect(getNativeMidiBridge()).toBe(getNativeMidiBridge())
	const midi2 = {}
	vi.stubGlobal("window", { electronAPI: { midi2 } })
	expect(getNativeMidiBridge()).toBe(midi2)
})