import {
	Peer,
	windowTransport,
	generatePairingCode,
	formatPairingCode,
	normalizePairingCode,
	type CommandRegistry,
	type Transport
} from "audiobus-protocol"
import AbstractInput from "./abstract-input"
import { getProtocolRegistry } from "../protocol-registry"
import { LayeredRegistry, registerMidiCommands } from "../protocol-input-commands"
import { midiToCommand } from "../../midi/midi-command-conversion"
import { umpToCommand } from "../../midi/ump-codec"
import { ProtocolMidiState, type ProtocolPacket } from "../protocol-midi-state"
import { changed, devicePanel } from "../device-controls"
import { EVENT_CHANGE, EVENT_CLICK, EVENT_MESSAGE } from "../../events/event-constants"

/** Most windows that may control one Input without pairing at the same time. */
export const MAX_UNPAIRED_PEERS = 8
const PROTOCOL_MESSAGE = /^(?:control|midi|ump|link),/

/** One connection's peer and the notes it holds, released when that connection ends. */
type Session = { peer: Peer; state: ProtocolMidiState }
type UnpairedSession = Session & { origin: string; deliver: (message: unknown) => void }

/**
 * Application control, MIDI commands and WebMidiLink MIDI from a paired application. With
 * `acceptUnpaired`, any window that sends protocol messages may control it without pairing.
 */
export default class InputProtocol extends AbstractInput {
	readonly requiresConnectionControl = true
	private target?: Window
	private origin?: string
	private requiredCode?: string
	private peer?: Peer
	private unpaired = new Map<MessageEventSource, UnpairedSession>()
	private stopUnpaired?: () => void
	private midiState = new ProtocolMidiState()
	private status?: HTMLElement
	private gui?: HTMLElement
	private generation = 0
	private destroyed = false
	get name(): string {
		return "audioBus Protocol"
	}
	get description(): string {
		return "Control application commands and play MIDI from a paired application"
	}
	hasMidiInput(): boolean {
		return true
	}
	hasSysexInput(): boolean {
		return this.options.allowSysex === true
	}
	get connection(): Peer | undefined {
		return this.peer
	}
	/** Connections from windows that sent messages without pairing. */
	get unpairedConnections(): Peer[] {
		return [...this.unpaired.values()].map((entry) => entry.peer)
	}
	/** The code the paired application must present, formatted for display. */
	get pairingCode(): string | undefined {
		return this.requiredCode === undefined ? undefined : formatPairingCode(this.requiredCode)
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
	}
	/** Application commands plus MIDI commands that play into this chain, tracked per connection. */
	private createCommands(state: ProtocolMidiState): LayeredRegistry {
		const commands = new LayeredRegistry(
			() => (this.options.registry as CommandRegistry | undefined) ?? getProtocolRegistry()
		)
		registerMidiCommands(commands, (bytes) =>
			this.receivePacket({ format: "midi", data: bytes }, state)
		)
		return commands
	}
	/**
	 * Pass `requirePairingCode` when this application did not choose the target window, such as
	 * `window.opener`; nothing from the peer is accepted until it presents that code.
	 */
	attach(target: Window, origin: string, options: { requirePairingCode?: string } = {}): void {
		// Validate before replacing a working connection.
		windowTransport(target, origin)
		const code =
			options.requirePairingCode === undefined
				? undefined
				: normalizePairingCode(options.requirePairingCode)
		if (code === "") {
			throw new Error("A pairing code must contain letters or digits")
		}
		void this.disconnect()
		this.target = target
		this.origin = origin
		this.requiredCode = code
	}
	private owns(peer: Peer): boolean {
		return (
			this.peer === peer || [...this.unpaired.values()].some((entry) => entry.peer === peer)
		)
	}
	private createPeer(
		transport: Transport,
		state: ProtocolMidiState,
		requirePairingCode?: string
	): Peer {
		const peer: Peer = new Peer(transport, {
			identity: { name: this.options.applicationName ?? "audioBus", version: "1" },
			registry: this.createCommands(state),
			getPatch: this.options.getPatch,
			setPatch: this.options.setPatch,
			ump: true,
			requirePairingCode,
			onAuthorized: () => {
				if (this.peer === peer && this.status) {
					this.status.textContent = "Connected. Pairing code accepted."
				}
			},
			onMidi: (bytes) => {
				if (this.owns(peer)) {
					this.receivePacket({ format: "midi", data: Array.from(bytes) }, state)
				}
			},
			onUmp: (words) => {
				if (this.owns(peer)) {
					this.receivePacket({ format: "ump", data: words }, state)
				}
			}
		})
		return peer
	}
	/** One peer per sending window; the window's own origin is the only reply target. */
	private listenUnpaired(): void {
		const listener = (event: MessageEvent) => {
			const source = event.source
			// Opaque or missing origins cannot be replied to without broadcasting.
			if (
				!source ||
				source === window ||
				source === this.target ||
				!event.origin ||
				event.origin === "null" ||
				typeof event.data !== "string" ||
				!PROTOCOL_MESSAGE.test(event.data)
			) {
				return
			}
			let entry = this.unpaired.get(source)
			if (entry && entry.origin !== event.origin) {
				// The window navigated to another application: start a fresh session.
				this.endUnpaired(source)
				entry = undefined
			}
			if (!entry) {
				// Closed windows and removed iframes free their slots before the limit applies.
				for (const [sender, session] of this.unpaired) {
					if ((sender as Window).closed === true) {
						this.endUnpaired(sender, session)
					}
				}
				if (this.unpaired.size >= MAX_UNPAIRED_PEERS) {
					return
				}
				const receivers = new Set<(message: unknown) => void>()
				const origin = event.origin
				const transport: Transport = {
					send: (message) => (source as Window).postMessage(message, origin),
					listen: (receive) => {
						receivers.add(receive)
						return () => {
							receivers.delete(receive)
						}
					}
				}
				const state = new ProtocolMidiState()
				entry = {
					origin,
					state,
					peer: this.createPeer(transport, state),
					deliver: (message) => receivers.forEach((receive) => receive(message))
				}
				this.unpaired.set(source, entry)
				this.updateStatus()
			}
			entry.deliver(event.data)
		}
		window.addEventListener(EVENT_MESSAGE, listener)
		this.stopUnpaired = () => {
			window.removeEventListener(EVENT_MESSAGE, listener)
			for (const source of this.unpaired.keys()) {
				this.endUnpaired(source)
			}
		}
	}
	/** Close one unpaired session and release only the notes it was holding. */
	private endUnpaired(source: MessageEventSource, session = this.unpaired.get(source)): void {
		if (!session) {
			return
		}
		this.unpaired.delete(source)
		session.peer.close()
		for (const release of session.state.release()) {
			this.dispatchPacket(release)
		}
		this.updateStatus()
	}
	async connect(): Promise<void> {
		if (this.isConnected) {
			return
		}
		const unpaired = this.options.acceptUnpaired === true
		if ((!this.target || !this.origin) && !unpaired) {
			throw new Error(
				"Pair an application window and exact origin using attach() first, or accept unpaired control"
			)
		}
		// Disconnect executes synchronously so parallel connects cannot leak listeners.
		void this.disconnect()
		const generation = ++this.generation
		if (unpaired) {
			this.listenUnpaired()
		}
		if (!this.target || !this.origin) {
			this.setAsConnected()
			this.updateStatus()
			return
		}
		const peer = this.createPeer(
			windowTransport(this.target, this.origin),
			this.midiState,
			this.requiredCode
		)
		this.peer = peer
		try {
			await peer.connect()
			if (generation !== this.generation) {
				return
			}
			this.setAsConnected()
			if (this.options.getPatch || this.options.setPatch) {
				peer.announceReady()
			}
			this.updateStatus()
		} catch (error) {
			if (generation === this.generation) {
				await this.disconnect()
			}
			throw error
		}
	}
	private connectedStatus(): string {
		const paired =
			this.peer && !this.peer.isAuthorized
				? `Connected. Enter pairing code ${this.pairingCode} in the other application and connect there.`
				: this.peer
					? "Connected"
					: ""
		const unpaired = this.stopUnpaired
			? `Accepting control from any window without pairing (${this.unpaired.size} connected).`
			: ""
		return [paired, unpaired].filter(Boolean).join(" ")
	}
	private updateStatus(): void {
		if (this.status) {
			this.status.textContent = this.isConnected
				? this.connectedStatus()
				: "Pair an application window and exact origin using attach(), then connect."
		}
	}
	private dispatchPacket(packet: ProtocolPacket): void {
		const command =
			packet.format === "ump"
				? umpToCommand(packet.data, this.now, this.uuid)
				: midiToCommand(packet.data, this.now, this.uuid)
		if (command) {
			this.dispatch(command)
		}
	}
	private receivePacket(packet: ProtocolPacket, state = this.midiState): void {
		const type = packet.data[0] >>> 28
		if (
			!this.options.allowSysex &&
			(packet.format === "midi" ? packet.data[0] === 0xf0 : type === 3 || type === 5)
		) {
			return
		}
		for (const release of state.accept(packet)) {
			this.dispatchPacket(release)
		}
		this.dispatchPacket(packet)
	}
	async disconnect(): Promise<void> {
		this.generation++
		this.peer?.close()
		this.peer = undefined
		this.stopUnpaired?.()
		this.stopUnpaired = undefined
		for (const release of this.midiState.release()) {
			this.dispatchPacket(release)
		}
		this.setAsDisconnected()
		this.updateStatus()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		this.gui = devicePanel()
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.updateStatus()
		const label = document.createElement("label")
		label.textContent = "Peer application URL"
		const url = document.createElement("input")
		url.type = "url"
		url.placeholder = "https://other-app.example/"
		label.append(url)
		const open = document.createElement("button")
		open.type = "button"
		open.textContent = "Open and pair application"
		open.addEventListener(EVENT_CLICK, () => {
			try {
				const address = new URL(url.value)
				if (!["https:", "http:"].includes(address.protocol)) {
					throw new Error("Use an HTTP or HTTPS application URL")
				}
				const target = window.open(address.href, "_blank")
				if (!target) {
					throw new Error("Allow popups to open the peer application")
				}
				this.attach(target, address.origin)
				this.status!.textContent =
					"Paired. When the other application is ready, press Connect."
			} catch (error) {
				this.status!.textContent = error instanceof Error ? error.message : String(error)
			}
		})
		const opener = document.createElement("button")
		opener.type = "button"
		opener.textContent = "Pair with opening application"
		opener.disabled = !window.opener
		opener.addEventListener(EVENT_CLICK, () => {
			try {
				const address = new URL(url.value)
				if (!window.opener) {
					throw new Error("This window has no opening application")
				}
				// The opener chose this window, so require a code the person copies across.
				this.attach(window.opener, address.origin, {
					requirePairingCode: generatePairingCode()
				})
				this.status!.textContent = `Paired with opening application. Enter pairing code ${this.pairingCode} in its Output, then press Connect in both applications.`
			} catch (error) {
				this.status!.textContent = error instanceof Error ? error.message : String(error)
			}
		})
		const unpairedLabel = document.createElement("label")
		const unpaired = document.createElement("input")
		unpaired.type = "checkbox"
		unpaired.checked = this.options.acceptUnpaired === true
		unpairedLabel.append(unpaired, " Accept control from any window without pairing")
		const warning = document.createElement("small")
		warning.textContent =
			"Any page that can message this window, such as one that opened or embeds it, can then play notes and press any control. Turn on only for pages you trust."
		unpaired.addEventListener(EVENT_CHANGE, () => {
			this.options.acceptUnpaired = unpaired.checked
			changed(this)
			// Apply the change to a running connection. Any later disconnect, connect or destroy
			// changes the generation and cancels this reconnect.
			const wasConnected = this.isConnected
			void this.disconnect()
			const generation = this.generation
			if (wasConnected && (this.target || unpaired.checked)) {
				queueMicrotask(() => {
					if (generation === this.generation && !this.destroyed) {
						this.connect().catch((error) => {
							if (this.status) {
								this.status.textContent =
									error instanceof Error ? error.message : String(error)
							}
						})
					}
				})
			}
		})
		this.gui.append(label, open, opener, unpairedLabel, warning, this.status)
		return this.gui
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
	}
	destroy(): void {
		this.destroyed = true
		void this.disconnect()
		this.target = undefined
		this.origin = undefined
		this.requiredCode = undefined
		void this.destroyGui()
	}
}