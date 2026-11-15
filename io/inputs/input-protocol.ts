import {
	Peer,
	windowTransport,
	generatePairingCode,
	formatPairingCode,
	normalizePairingCode,
	type CommandRegistry
} from "audiobus-protocol"
import AbstractInput from "./abstract-input"
import { getProtocolRegistry } from "../protocol-registry"
import { midiToCommand } from "../../midi/midi-command-conversion"
import { umpToCommand } from "../../midi/ump-codec"
import { ProtocolMidiState, type ProtocolPacket } from "../protocol-midi-state"
import { devicePanel } from "../device-controls"
import { EVENT_CLICK } from "../../events/event-constants"

/** Explicitly paired application control and WebMidiLink MIDI input. */
export default class InputProtocol extends AbstractInput {
	readonly requiresConnectionControl = true
	private target?: Window
	private origin?: string
	private requiredCode?: string
	private peer?: Peer
	private midiState = new ProtocolMidiState()
	private status?: HTMLElement
	private gui?: HTMLElement
	private generation = 0
	get name(): string {
		return "audioBus Protocol"
	}
	get description(): string {
		return "Control application commands and receive WebMidiLink MIDI from a paired application"
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
	/** The code the paired application must present, formatted for display. */
	get pairingCode(): string | undefined {
		return this.requiredCode === undefined ? undefined : formatPairingCode(this.requiredCode)
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
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
	async connect(): Promise<void> {
		if (this.isConnected) {
			return
		}
		if (!this.target || !this.origin) {
			throw new Error("Pair an application window and exact origin using attach() first")
		}
		// Disconnect executes synchronously so parallel connects cannot leak listeners.
		void this.disconnect()
		const generation = ++this.generation
		const peer = new Peer(windowTransport(this.target, this.origin), {
			identity: { name: this.options.applicationName ?? "audioBus", version: "1" },
			registry:
				(this.options.registry as CommandRegistry | undefined) ?? getProtocolRegistry(),
			getPatch: this.options.getPatch,
			setPatch: this.options.setPatch,
			ump: true,
			requirePairingCode: this.requiredCode,
			onAuthorized: () => {
				if (this.peer === peer && this.status) {
					this.status.textContent = "Connected. Pairing code accepted."
				}
			},
			onMidi: (bytes) => {
				if (this.peer === peer) {
					this.receivePacket({ format: "midi", data: Array.from(bytes) })
				}
			},
			onUmp: (words) => {
				if (this.peer === peer) {
					this.receivePacket({ format: "ump", data: words })
				}
			}
		})
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
			if (this.status) {
				this.status.textContent = this.connectedStatus()
			}
		} catch (error) {
			if (generation === this.generation) {
				await this.disconnect()
			}
			throw error
		}
	}
	private connectedStatus(): string {
		return this.peer && !this.peer.isAuthorized
			? `Connected. Enter pairing code ${this.pairingCode} in the other application and connect there.`
			: "Connected"
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
	private receivePacket(packet: ProtocolPacket): void {
		const type = packet.data[0] >>> 28
		if (
			!this.options.allowSysex &&
			(packet.format === "midi" ? packet.data[0] === 0xf0 : type === 3 || type === 5)
		) {
			return
		}
		for (const release of this.midiState.accept(packet)) {
			this.dispatchPacket(release)
		}
		this.dispatchPacket(packet)
	}
	async disconnect(): Promise<void> {
		this.generation++
		this.peer?.close()
		this.peer = undefined
		for (const release of this.midiState.release()) {
			this.dispatchPacket(release)
		}
		this.setAsDisconnected()
		if (this.status) {
			this.status.textContent = "Disconnected — pair an application window using attach()."
		}
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		this.gui = devicePanel()
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.textContent = this.isConnected
			? this.connectedStatus()
			: "Pair an application window and exact origin using attach(), then connect."
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
		this.gui.append(label, open, opener, this.status)
		return this.gui
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
	}
	destroy(): void {
		void this.disconnect()
		this.target = undefined
		this.origin = undefined
		this.requiredCode = undefined
		void this.destroyGui()
	}
}