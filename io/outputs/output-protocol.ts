import {
	Peer,
	windowTransport,
	ProtocolError,
	type Transport,
	type Params,
	type Json,
	type CommandDescriptor,
	type CommandRegistry,
	type PropertyDescriptor,
	type CapabilityBundle,
	type SubscriptionState,
	TOPIC_COMMANDS_CHANGED,
	TOPIC_PROPERTIES_CHANGED,
	TOPIC_PROPERTIES_LIST_CHANGED
} from "audiobus-protocol"
import { getProtocolRegistry } from "../protocol-registry"
import { commandToMidi } from "../../midi/midi-command-conversion"
import { commandToUmp, umpToMidiBytes } from "../../midi/ump-codec"
import { ProtocolMidiState, type ProtocolPacket } from "../protocol-midi-state"
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
	private pairingCode?: string
	private peer?: Peer
	private connected = false
	private connecting?: Promise<void>
	private generation = 0
	private midiState = new ProtocolMidiState()
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
	/** `pairingCode` is the code shown by a destination that requires one. */
	attach(target: Window, origin: string, options: { pairingCode?: string } = {}): void {
		this.attachTransport(windowTransport(target, origin), options)
	}
	/** A custom transport must already isolate and authorize the destination. */
	attachTransport(transport: Transport, options: { pairingCode?: string } = {}): void {
		void this.disconnect()
		this.transport = transport
		this.setPairingCode(options.pairingCode)
	}
	/** Used by the next connection; codes belong to one pairing and are never saved. */
	setPairingCode(code?: string): void {
		this.pairingCode = code?.trim() || undefined
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
		if (this.pairingCode && this.options.mode !== "audiobus") {
			return Promise.reject(
				new Error(
					"Pairing codes require audioBus Protocol mode; WebMidiLink cannot present one"
				)
			)
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
			pairingCode: this.pairingCode,
			ump: this.options.mode === "audiobus",
			onPatch: (patch) =>
				this.dispatchEvent(new CustomEvent(EVENT_PROTOCOL_PATCH, { detail: patch })),
			onEvent: (topic, data) => {
				this.dispatchEvent(
					new CustomEvent(EVENT_PROTOCOL_EVENT, { detail: { topic, data } })
				)
				if (topic === TOPIC_COMMANDS_CHANGED) {
					void this.gui?.refresh()
				}
				if (topic === TOPIC_PROPERTIES_LIST_CHANGED) {
					void this.gui?.refresh()
				}
				if (topic === TOPIC_PROPERTIES_CHANGED) {
					this.gui?.propertyChanged(data)
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
					await peer.subscribe(TOPIC_COMMANDS_CHANGED)
					if (peer.supports("properties")) {
						await peer.subscribe(TOPIC_PROPERTIES_CHANGED)
						await peer.subscribe(TOPIC_PROPERTIES_LIST_CHANGED)
					}
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
	/** Subscribe and receive retained state captured with the subscription, when provided. */
	async subscribeState(topic: string): Promise<SubscriptionState> {
		return this.requirePeer(true).subscribeState(topic)
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
	async listProperties(): Promise<PropertyDescriptor[]> {
		return this.requirePeer(true).listProperties()
	}
	async getProperty(id: string): Promise<Json> {
		return this.requirePeer(true).getProperty(id)
	}
	async setProperty(id: string, value: Json): Promise<Json> {
		return this.requirePeer(true).setProperty(id, value)
	}
	async listBundles(): Promise<CapabilityBundle[]> {
		return this.requirePeer(true).listBundles()
	}
	getNoteKey(command: IAudioCommand): string {
		const words = command.ump ? commandToUmp(command) : undefined
		return `${words ? (words[0] >>> 24) & 15 : 0}:${command.channel || 1}:${command.number}`
	}
	private sendPacket(packet: ProtocolPacket): void {
		if (!this.peer) {
			return
		}
		if (packet.format === "ump") {
			this.peer.sendUmp(packet.data)
		} else {
			this.peer.sendMidi(packet.data)
		}
	}
	sendCommand(command: IAudioCommand): void {
		if (!this.connected || !this.peer) {
			return
		}
		let packet: ProtocolPacket
		if (command.ump) {
			const words = commandToUmp(command)
			const type = words[0] >>> 28
			if (!this.hasSysexOutput() && (type === 3 || type === 5)) {
				return
			}
			if (this.peer.supports("ump")) {
				packet = { format: "ump", data: words }
			} else {
				// Lossy conversion is opt-in and never merges nonzero UMP groups.
				const group = (words[0] >>> 24) & 15
				const kind = (words[0] >>> 20) & 15
				const extended =
					type === 4 &&
					(((kind === 8 || kind === 9) && (words[0] & 255) !== 0) ||
						(kind === 12 && (words[0] & 0xffff) !== 0))
				const bytes =
					(type === 1 || type === 2 || type === 4) && group === 0 && !extended
						? umpToMidiBytes(words)
						: undefined
				if (!this.options.allowMidi1Fallback || !bytes) {
					throw new ProtocolError(
						"unsupported_capability",
						"Destination cannot receive this UMP packet; MIDI 1 conversion must be explicitly enabled and representable in group zero"
					)
				}
				packet = { format: "midi", data: bytes }
			}
		} else {
			const bytes = commandToMidi(command)
			if (!bytes || (bytes[0] === 0xf0 && !this.hasSysexOutput())) {
				return
			}
			packet = { format: "midi", data: bytes }
		}
		for (const release of this.midiState.accept(packet)) {
			this.sendPacket(release)
		}
		this.sendPacket(packet)
	}
	noteOn(number: number, velocity = 127, channel = 1): void {
		this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel }))
	}
	noteOff(number: number, channel = 1): void {
		this.sendCommand(musicalCommand({ type: NOTE_OFF, number, velocity: 0, channel }))
	}
	allNotesOff(): void {
		const releases = this.midiState.release()
		if (this.connected && this.peer) {
			for (const release of releases) {
				this.sendPacket(release)
			}
		}
	}
	async disconnect(): Promise<void> {
		this.generation++
		try {
			this.allNotesOff()
		} catch {
			// A closed destination may reject note releases; teardown must still finish.
		} finally {
			this.midiState.release()
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