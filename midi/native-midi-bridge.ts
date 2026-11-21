export interface NativeMidiDevice {
	index: number
	name: string
	id?: string
	protocol?: number
	purpose?: number
}
export interface NativeMidiBridge {
	getUmpInputs(diagnostics?: boolean): Promise<NativeMidiDevice[]>
	getUmpOutputs(diagnostics?: boolean): Promise<NativeMidiDevice[]>
	getCapabilities(): Promise<{ midi2Support: boolean; umpSupport: boolean; perNoteCC: boolean }>
	openUmpInput(index: number): Promise<void>
	closeUmpInput(index: number): Promise<void>
	openUmpOutput(index: number): Promise<void>
	closeUmpOutput(index: number): Promise<void>
	sendUmp(index: number, words: number[]): Promise<void>
	onUmpInput(
		callback: (index: number, words: number[], nativeTimestamp?: number) => void
	): () => void
}

/** An Electron preload that names ports by endpoint id, as InterFACE's does */
export interface EndpointMidiPort {
	id: string
	name?: string
	manufacturer?: string
}
export interface EndpointMidiBridge {
	available: boolean
	getPorts(): Promise<{ inputs?: EndpointMidiPort[]; outputs?: EndpointMidiPort[] }>
	sendUMP(portId: string, words: number[], timestamp?: number): Promise<unknown>
	onMessage(
		callback: (message: { endpointId: string; timestamp?: number; words: number[] }) => void
	): () => void
	onPortsChanged(
		callback: (ports: { inputs?: EndpointMidiPort[]; outputs?: EndpointMidiPort[] }) => void
	): () => void
}

/**
 * Presents an endpoint bridge as a numbered one. Each endpoint keeps the number it
 * was first given, so a replugged device returns to its number and a number never
 * moves to another device. Its ports are always open, so opening and closing do nothing.
 */
export function createEndpointMidiBridge(endpoints: EndpointMidiBridge): NativeMidiBridge {
	const numbered = () => {
		const indices = new Map<string, number>()
		const ids: string[] = []
		const ports = new Map<string, EndpointMidiPort>()
		return {
			ports,
			index(id: string): number {
				if (!indices.has(id)) {
					indices.set(id, ids.push(id) - 1)
				}
				return indices.get(id)!
			},
			id: (index: number): string | undefined => ids[index],
			update(list: EndpointMidiPort[] = []) {
				ports.clear()
				for (const port of list) {
					ports.set(String(port.id), port)
				}
			},
			devices(): NativeMidiDevice[] {
				return [...ports.values()].map((port) => ({
					index: this.index(String(port.id)),
					id: String(port.id),
					name: port.name || String(port.id)
				}))
			}
		}
	}
	const inputs = numbered(),
		outputs = numbered()
	const update = (ports: Awaited<ReturnType<EndpointMidiBridge["getPorts"]>>) => {
		inputs.update(ports?.inputs)
		outputs.update(ports?.outputs)
	}
	let watching: (() => void) | undefined
	const refresh = async () => {
		watching ??= endpoints.onPortsChanged(update)
		update(await endpoints.getPorts())
	}
	const opened = async (list: typeof inputs, index: number) => {
		if (list.id(index) === undefined) {
			await refresh()
		}
		if (list.id(index) === undefined) {
			throw new Error(`There is no MIDI port ${index}`)
		}
	}
	return {
		async getUmpInputs() {
			await refresh()
			return inputs.devices()
		},
		async getUmpOutputs() {
			await refresh()
			return outputs.devices()
		},
		// The bridge carries whole UMP packets, so MIDI 2 and per-note messages pass through
		getCapabilities: async () => ({ midi2Support: true, umpSupport: true, perNoteCC: true }),
		openUmpInput: (index) => opened(inputs, index),
		closeUmpInput: async () => {},
		openUmpOutput: (index) => opened(outputs, index),
		closeUmpOutput: async () => {},
		async sendUmp(index, words) {
			const id = outputs.id(index)
			if (id === undefined || !outputs.ports.has(id)) {
				throw new Error(`MIDI output ${index} is not connected`)
			}
			await endpoints.sendUMP(id, [...words])
		},
		onUmpInput(callback) {
			return endpoints.onMessage((message) => {
				const id = String(message.endpointId)
				if (inputs.ports.has(id)) {
					callback(inputs.index(id), [...message.words], message.timestamp)
				}
			})
		}
	}
}

const endpointBridges = new WeakMap<EndpointMidiBridge, NativeMidiBridge>()

function findNativeMidiBridge(): NativeMidiBridge | undefined {
	const scope = (globalThis as any).window ?? globalThis
	if (scope.electronAPI?.midi2) {
		return scope.electronAPI.midi2
	}
	const endpoints: EndpointMidiBridge | undefined = scope.electron?.midi
	if (!endpoints?.available) {
		return
	}
	if (!endpointBridges.has(endpoints)) {
		endpointBridges.set(endpoints, createEndpointMidiBridge(endpoints))
	}
	return endpointBridges.get(endpoints)
}

export function hasNativeMidiBridge(): boolean {
	return findNativeMidiBridge() !== undefined
}

export function getNativeMidiBridge(): NativeMidiBridge {
	const bridge = findNativeMidiBridge()
	if (!bridge) {
		throw new Error("Native MIDI requires the Electron desktop app")
	}
	return bridge
}