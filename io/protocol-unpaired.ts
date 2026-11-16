import {
	Peer,
	isInitializeRequest,
	MAX_MESSAGE_LENGTH,
	type CommandRegistry,
	type Transport
} from "audiobus-protocol"
import { LayeredRegistry, registerMidiCommands } from "./protocol-input-commands"
import { getProtocolRegistry } from "./protocol-registry"
import type { ProtocolPacket } from "./protocol-midi-state"
import { EVENT_MESSAGE } from "../events/event-constants"

/** Most windows that may control this application without pairing at the same time. */
export const MAX_UNPAIRED_PEERS = 8
/** A window that sends an initialize request but never completes it loses its slot after this. */
export const UNPAIRED_INITIALIZE_TIMEOUT_MS = 10000

/** An Input that plays MIDI from unpaired windows. */
export interface UnpairedMember {
	/** MIDI from one session, whether sent as a command or as WebMidiLink MIDI. */
	receive(session: number, packet: ProtocolPacket): void
	/** The session ended; release anything held for it. */
	end(session: number): void
	/** The number of sessions changed. */
	changed?(): void
	identity?: { name: string; version: string }
	registry?: CommandRegistry
	/** A window this member already talks to by pairing; its messages are never unpaired. */
	paired?: () => Window | undefined
	onError?: (error: unknown, context: string) => void
}

type Session = {
	id: number
	origin: string
	peer: Peer
	deliver: (message: unknown) => void
	timer: ReturnType<typeof setTimeout>
}

/**
 * One window listener for the whole application, so a request from an unpaired window executes
 * each application command once however many Inputs accept unpaired control. Every sending window
 * gets one session; its MIDI reaches every member, and replies go only to that window's origin.
 */
class UnpairedHost {
	private members = new Set<UnpairedMember>()
	private sessions = new Map<MessageEventSource, Session>()
	private sequence = 0
	private stop?: () => void

	get count(): number {
		return this.sessions.size
	}
	get peers(): Peer[] {
		return [...this.sessions.values()].map((session) => session.peer)
	}
	join(member: UnpairedMember): () => void {
		this.members.add(member)
		if (!this.stop) {
			this.listen()
		}
		return () => {
			if (!this.members.delete(member)) {
				return
			}
			if (this.members.size === 0) {
				this.stop?.()
				this.stop = undefined
			}
		}
	}
	private listen(): void {
		const listener = (event: MessageEvent) => this.receive(event)
		window.addEventListener(EVENT_MESSAGE, listener)
		this.stop = () => {
			window.removeEventListener(EVENT_MESSAGE, listener)
			for (const source of this.sessions.keys()) {
				this.end(source)
			}
		}
	}
	private receive(event: MessageEvent): void {
		const source = event.source
		// Opaque or missing origins cannot be replied to without broadcasting.
		if (
			!source ||
			source === window ||
			!event.origin ||
			event.origin === "null" ||
			typeof event.data !== "string" ||
			event.data.length > MAX_MESSAGE_LENGTH
		) {
			return
		}
		for (const member of this.members) {
			if (member.paired?.() === source) {
				return
			}
		}
		let session = this.sessions.get(source)
		if (session && session.origin !== event.origin) {
			// The window navigated to another application: start a fresh session.
			this.end(source)
			session = undefined
		}
		if (!session) {
			// Only a connection attempt earns a slot; stray or malformed traffic does not.
			if (!isInitializeRequest(event.data)) {
				return
			}
			// Closed windows and removed iframes free their slots before the limit applies.
			for (const [sender, open] of this.sessions) {
				if ((sender as Window).closed === true) {
					this.end(sender, open)
				}
			}
			if (this.sessions.size >= MAX_UNPAIRED_PEERS) {
				return
			}
			session = this.open(source, event.origin)
		}
		session.deliver(event.data)
	}
	private open(source: MessageEventSource, origin: string): Session {
		const id = ++this.sequence
		const receivers = new Set<(message: unknown) => void>()
		const transport: Transport = {
			send: (message) => (source as Window).postMessage(message, origin),
			listen: (receive) => {
				receivers.add(receive)
				return () => {
					receivers.delete(receive)
				}
			}
		}
		const [first] = this.members
		const registry = new LayeredRegistry(first?.registry ?? getProtocolRegistry())
		const play = (packet: ProtocolPacket) => {
			for (const member of this.members) {
				member.receive(id, packet)
			}
		}
		registerMidiCommands(registry, (bytes) => play({ format: "midi", data: bytes }))
		const peer = new Peer(transport, {
			identity: first?.identity ?? { name: "audioBus", version: "1" },
			registry,
			ump: true,
			onMidi: (bytes) => play({ format: "midi", data: Array.from(bytes) }),
			onUmp: (words) => play({ format: "ump", data: words }),
			onClosed: () => this.end(source),
			onError: (error, context) => {
				for (const member of this.members) {
					member.onError?.(error, context)
				}
			}
		})
		const session: Session = {
			id,
			origin,
			peer,
			deliver: (message) => receivers.forEach((receive) => receive(message)),
			timer: setTimeout(() => {
				if (!peer.isInitialized) {
					this.end(source, session)
				}
			}, UNPAIRED_INITIALIZE_TIMEOUT_MS)
		}
		this.sessions.set(source, session)
		this.changed()
		return session
	}
	/** Close one session; every member releases only the notes it held for it. */
	private end(source: MessageEventSource, session = this.sessions.get(source)): void {
		// A stale reference must never end the window's newer session.
		if (!session || this.sessions.get(source) !== session) {
			return
		}
		this.sessions.delete(source)
		clearTimeout(session.timer)
		session.peer.close()
		for (const member of this.members) {
			member.end(session.id)
		}
		this.changed()
	}
	private changed(): void {
		for (const member of this.members) {
			member.changed?.()
		}
	}
}

const host = new UnpairedHost()

/** Start receiving unpaired control; returns a function that stops it for this member. */
export function joinUnpaired(member: UnpairedMember): () => void {
	return host.join(member)
}
export function unpairedSessionCount(): number {
	return host.count
}
export function unpairedPeers(): Peer[] {
	return host.peers
}