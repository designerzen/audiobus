import { Peer, windowTransport, type CommandRegistry } from "audiobus-protocol"
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
	get connection(): Peer | undefined {
		return this.peer
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
	}
	attach(target: Window, origin: string): void {
		// Validate before replacing a working connection.
		windowTransport(target, origin)
		void this.disconnect()
		this.target = target
		this.origin = origin
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
			onMidi: (bytes) => { if (this.peer === peer) this.receivePacket({ format: "midi", data: Array.from(bytes) }) },
			onUmp: (words) => { if (this.peer === peer) this.receivePacket({ format: "ump", data: words }) }
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
				this.status.textContent = "Connected"
			}
		} catch (error) {
			if (generation === this.generation) {
				await this.disconnect()
			}
			throw error
		}
	}
	private dispatchPacket(packet: ProtocolPacket): void {
		const command = packet.format === "ump" ? umpToCommand(packet.data, this.now, this.uuid) : midiToCommand(packet.data, this.now, this.uuid)
		if (command) this.dispatch(command)
	}
	private receivePacket(packet: ProtocolPacket): void {
		const type = packet.data[0] >>> 28
		if (!this.options.allowSysex && (packet.format === "midi" ? packet.data[0] === 0xf0 : type === 3 || type === 5)) return
		for (const release of this.midiState.accept(packet)) this.dispatchPacket(release)
		this.dispatchPacket(packet)
	}
	async disconnect(): Promise<void> {
		this.generation++
		this.peer?.close()
		this.peer = undefined
		for (const release of this.midiState.release()) this.dispatchPacket(release)
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
			? "Connected"
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
				this.attach(window.opener, address.origin)
				this.status!.textContent =
					"Paired with opening application. Press Connect in both applications."
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
		void this.destroyGui()
	}
}