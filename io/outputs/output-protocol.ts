import {
	Peer,
	windowTransport,
	ProtocolError,
	type Transport,
	type Params,
	type Json,
	type CommandDescriptor,
	type CommandRegistry
} from "audiobus-protocol"
import { getProtocolRegistry } from "../protocol-registry"
import { commandToMidi } from "../../midi/midi-command-conversion"
import { musicalCommand } from "../event-clip"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands"
import {
	EVENT_CONNECTION_CHANGED,
	EVENT_PROTOCOL_EVENT,
	EVENT_PROTOCOL_PATCH
} from "../../events/event-constants"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { IAudioOutput } from "./output-interface"
import { createProtocolOutputControls } from "../protocol-output-controls"

/** A MIDI destination and symmetric application-control peer, with explicit pairing. */
export default class OutputProtocol extends EventTarget implements IAudioOutput {
	readonly uuid = `output-protocol-${crypto.randomUUID()}`
	readonly name = "audioBus Protocol"
	readonly description = "Send MIDI and control a paired music application"
	readonly isHidden = false
	readonly requiresConnectionControl = true
	readonly configurationAffectsNoteRouting = false
	readonly options: Record<string, any>
	private transport?: Transport
	private peer?: Peer
	private connected = false
	private connecting?: Promise<void>
	private generation = 0
	private held = new Map<string, { note: number; channel: number }>()
	private sustain = new Set<number>()
	private gui?: ReturnType<typeof createProtocolOutputControls>
	constructor(options: Record<string, any> = {}) {
		super()
		this.options = { mode: "audiobus", url: "", ...options }
	}
	get isConnected(): boolean {
		return this.connected
	}
	get connection(): Peer | undefined {
		return this.peer
	}
	hasMidiOutput(): boolean {
		return true
	}
	hasAudioOutput(): boolean {
		return false
	}
	hasSysexOutput(): boolean {
		return this.options.allowSysex === true
	}
	attach(target: Window, origin: string): void {
		this.attachTransport(windowTransport(target, origin))
	}
	/** A custom transport must already isolate and authorize the destination. */
	attachTransport(transport: Transport): void {
		void this.disconnect()
		this.transport = transport
	}
	connect(): Promise<void> {
		if (this.connected) {
			return Promise.resolve()
		}
		if (this.connecting) {
			return this.connecting
		}
		if (!this.transport) {
			return Promise.reject(new Error("Pair a destination application before connecting"))
		}
		if (!["audiobus", "webmidilink"].includes(this.options.mode)) {
			return Promise.reject(new Error("Unknown protocol mode"))
		}
		const generation = ++this.generation
		const peer = new Peer(this.transport, {
			identity: { name: this.options.applicationName ?? "audioBus", version: "1" },
			registry:
				this.options.mode === "audiobus"
					? ((this.options.registry as CommandRegistry | undefined) ??
						getProtocolRegistry())
					: undefined,
			timeoutMs: this.options.timeoutMs,
			onPatch: (patch) =>
				this.dispatchEvent(new CustomEvent(EVENT_PROTOCOL_PATCH, { detail: patch })),
			onEvent: (topic, data) => {
				this.dispatchEvent(
					new CustomEvent(EVENT_PROTOCOL_EVENT, { detail: { topic, data } })
				)
				if (topic === "commands.changed") {
					void this.gui?.refresh()
				}
			}
		})
		this.peer = peer
		const connecting = (async () => {
			try {
				if (this.options.mode === "audiobus") {
					await peer.connect()
				}
				if (generation !== this.generation) {
					return
				}
				this.setConnected(true)
				if (this.options.mode === "audiobus") {
					await peer.subscribe("commands.changed")
				}
				await this.gui?.refresh()
			} catch (error) {
				if (generation === this.generation) {
					await this.disconnect()
				}
				throw error
			}
		})()
		this.connecting = connecting
		const clear = () => {
			if (this.connecting === connecting) {
				this.connecting = undefined
			}
		}
		void connecting.then(clear, clear)
		return connecting
	}
	private setConnected(value: boolean): void {
		if (this.connected === value) {
			return
		}
		this.connected = value
		this.gui?.update()
		this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
	}
	private requirePeer(control = false): Peer {
		if (!this.peer || !this.connected) {
			throw new ProtocolError("not_initialized", "Connect to a destination first")
		}
		if (control && this.options.mode !== "audiobus") {
			throw new ProtocolError(
				"unavailable",
				"Application commands require audioBus Protocol mode"
			)
		}
		return this.peer
	}
	async discover(): Promise<CommandDescriptor[]> {
		return this.requirePeer(true).discover()
	}
	async call(command: string, args: Params = {}): Promise<Json> {
		return this.requirePeer(true).call(command, args)
	}
	async subscribe(topic: string): Promise<Json> {
		return this.requirePeer(true).subscribe(topic)
	}
	async unsubscribe(topic: string): Promise<Json> {
		return this.requirePeer(true).unsubscribe(topic)
	}
	requestPatch(): void {
		this.requirePeer().requestPatch()
	}
	setPatch(patch: string): void {
		this.requirePeer().setPatch(patch)
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel || 1}:${command.number}`
	}
	sendCommand(command: IAudioCommand): void {
		if (!this.connected || !this.peer) {
			return
		}
		const bytes = commandToMidi(command)
		if (!bytes || (bytes[0] === 0xf0 && !this.hasSysexOutput())) {
			return
		}
		const previous = this.held.get(`${(bytes[0]! & 15) + 1}:${bytes[1]}`)
		if (bytes[0]! >> 4 === 9 && bytes[2]! > 0 && previous) {
			this.peer.sendMidi([0x80 | (previous.channel - 1), previous.note, 0])
		}
		this.peer.sendMidi(bytes)
		if (bytes[0]! >= 0xf0) {
			return
		}
		const channel = (bytes[0]! & 15) + 1
		const kind = bytes[0]! >> 4
		const key = `${channel}:${bytes[1]}`
		if (kind === 9 && bytes[2]! > 0) {
			this.held.set(key, { note: bytes[1]!, channel })
		} else if (kind === 8 || kind === 9) {
			this.held.delete(key)
		}
		if (kind === 0xb) {
			if (bytes[1] === 64) {
				if (bytes[2]! >= 64) {
					this.sustain.add(channel)
				} else {
					this.sustain.delete(channel)
				}
			} else if (bytes[1] === 121) {
				this.sustain.delete(channel)
			} else if (bytes[1] === 120 || bytes[1] === 123) {
				for (const [noteKey, note] of this.held) {
					if (note.channel === channel) {
						this.held.delete(noteKey)
					}
				}
			}
		}
	}
	noteOn(number: number, velocity = 127, channel = 1): void {
		this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel }))
	}
	noteOff(number: number, channel = 1): void {
		this.sendCommand(musicalCommand({ type: NOTE_OFF, number, velocity: 0, channel }))
	}
	allNotesOff(): void {
		if (this.connected && this.peer) {
			for (const channel of this.sustain) {
				this.peer.sendMidi([0xb0 | (channel - 1), 64, 0])
			}
			for (const { note, channel } of this.held.values()) {
				this.peer.sendMidi([0x80 | (channel - 1), note, 0])
			}
		}
		this.sustain.clear()
		this.held.clear()
	}
	async disconnect(): Promise<void> {
		this.generation++
		try {
			this.allNotesOff()
		} catch {
			// A closed destination may reject note releases; teardown must still finish.
		} finally {
			this.held.clear()
			this.sustain.clear()
			this.peer?.close()
			this.peer = undefined
			this.connecting = undefined
			this.setConnected(false)
		}
	}
	async createGui(): Promise<HTMLElement> {
		this.gui ??= createProtocolOutputControls(this)
		return this.gui.element
	}
	async destroyGui(): Promise<void> {
		this.gui?.destroy()
		this.gui = undefined
	}
	destroy(): void {
		void this.disconnect()
		this.transport = undefined
		void this.destroyGui()
	}
}