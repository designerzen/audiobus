import {
	Peer,
	windowTransport,
	assertPeerOrigin,
	generatePairingCode,
	formatPairingCode,
	normalizePairingCode,
	type CommandRegistry
} from "audiobus-protocol"
import AbstractInput from "./abstract-input"
import { getProtocolRegistry } from "../protocol-registry"
import { LayeredRegistry, registerMidiCommands } from "../protocol-input-commands"
import { joinUnpaired, unpairedPeers, unpairedSessionCount } from "../protocol-unpaired"
import { midiToCommand } from "../../midi/midi-command-conversion"
import { umpToCommand } from "../../midi/ump-codec"
import { ProtocolMidiState, type ProtocolPacket } from "../protocol-midi-state"
import { changed, devicePanel } from "../device-controls"
import { EVENT_CHANGE, EVENT_CLICK } from "../../events/event-constants"

export { MAX_UNPAIRED_PEERS } from "../protocol-unpaired"

/**
 * Application control, MIDI commands and WebMidiLink MIDI from a paired application. With
 * `acceptUnpaired`, any window that sends protocol messages may control it without pairing;
 * those sessions are shared by every Input that accepts them, so each command executes once.
 */
export default class InputProtocol extends AbstractInput {
	readonly requiresConnectionControl = true
	private target?: Window
	private origin?: string
	private requiredCode?: string
	private peer?: Peer
	private leaveUnpaired?: () => void
	private midiState = new ProtocolMidiState()
	/** Notes held by each unpaired session, released when that session ends. */
	private sessionStates = new Map<number, ProtocolMidiState>()
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
		return this.leaveUnpaired ? unpairedPeers() : []
	}
	/** The code the paired application must present, formatted for display. */
	get pairingCode(): string | undefined {
		return this.requiredCode === undefined ? undefined : formatPairingCode(this.requiredCode)
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
	}
	private get registry(): CommandRegistry {
		return (this.options.registry as CommandRegistry | undefined) ?? getProtocolRegistry()
	}
	private get identity(): { name: string; version: string } {
		return { name: this.options.applicationName ?? "audioBus", version: "1" }
	}
	/**
	 * Pass `requirePairingCode` when this application did not choose the target window, such as
	 * `window.opener`; nothing from the peer is accepted until it presents that code.
	 */
	attach(target: Window, origin: string, options: { requirePairingCode?: string } = {}): void {
		// Validate before replacing a working connection.
		assertPeerOrigin(origin)
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
	private createPairedPeer(target: Window, origin: string): Peer {
		const commands = new LayeredRegistry(this.registry)
		registerMidiCommands(commands, (bytes) =>
			this.receivePacket({ format: "midi", data: bytes }, this.midiState)
		)
		const peer: Peer = new Peer(windowTransport(target, origin), {
			identity: this.identity,
			registry: commands,
			getPatch: this.options.getPatch,
			setPatch: this.options.setPatch,
			ump: true,
			requirePairingCode: this.requiredCode,
			onAuthorized: () => {
				if (this.peer === peer && this.status) {
					this.status.textContent = "Connected. Pairing code accepted."
				}
			},
			onClosed: () => {
				if (this.peer !== peer) {
					return
				}
				// The other application ended the connection: release its notes and wait.
				void this.disconnect()
				if (this.status) {
					this.status.textContent =
						"The other application closed the connection. Press Connect to pair again."
				}
			},
			onError: (error, context) => this.report(error, context),
			onMidi: (bytes) =>
				this.receivePacket({ format: "midi", data: Array.from(bytes) }, this.midiState),
			onUmp: (words) => this.receivePacket({ format: "ump", data: words }, this.midiState)
		})
		return peer
	}
	private report(error: unknown, context: string): void {
		console.warn(`audioBus Protocol input: ${context}`, error)
	}
	private sessionState(session: number): ProtocolMidiState {
		let state = this.sessionStates.get(session)
		if (!state) {
			state = new ProtocolMidiState()
			this.sessionStates.set(session, state)
		}
		return state
	}
	private endSession(session: number): void {
		const state = this.sessionStates.get(session)
		if (!state) {
			return
		}
		this.sessionStates.delete(session)
		for (const release of state.release()) {
			this.dispatchPacket(release)
		}
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
			this.leaveUnpaired = joinUnpaired({
				identity: this.identity,
				registry: this.registry,
				paired: () => this.target,
				receive: (session, packet) =>
					this.receivePacket(packet, this.sessionState(session)),
				end: (session) => this.endSession(session),
				changed: () => this.updateStatus(),
				onError: (error, context) => this.report(error, context)
			})
		}
		if (!this.target || !this.origin) {
			this.setAsConnected()
			this.updateStatus()
			return
		}
		const peer = this.createPairedPeer(this.target, this.origin)
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
		const paired = !this.peer
			? ""
			: this.peer.isLocked
				? "Too many incorrect pairing codes. Pair the application again to get a new code."
				: this.peer.isAuthorized
					? "Connected"
					: `Connected. Enter pairing code ${this.pairingCode} in the other application and connect there.`
		const unpaired = this.leaveUnpaired
			? `Accepting control from any window without pairing (${unpairedSessionCount()} connected).`
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
	private receivePacket(packet: ProtocolPacket, state: ProtocolMidiState): void {
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
		this.leaveUnpaired?.()
		this.leaveUnpaired = undefined
		for (const session of this.sessionStates.keys()) {
			this.endSession(session)
		}
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