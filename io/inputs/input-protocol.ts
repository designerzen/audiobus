import {
	Peer,
	windowTransport,
	midiTransport,
	findMidiPort,
	assertPeerOrigin,
	generatePairingCode,
	formatPairingCode,
	normalizePairingCode,
	normalizeSecret,
	isInitializeRequest,
	type CommandRegistry,
	type MidiAccessLike,
	type Transport
} from "audiobus-protocol"
import AbstractInput from "./abstract-input"
import { getProtocolRegistry } from "../protocol-registry"
import { LayeredRegistry, registerMidiCommands } from "../protocol-input-commands"
import { joinUnpaired, unpairedPeers, unpairedSessionCount } from "../protocol-unpaired"
import { midiToCommand } from "../../midi/midi-command-conversion"
import { umpToCommand } from "../../midi/ump-codec"
import { ProtocolMidiState, type ProtocolPacket } from "../protocol-midi-state"
import { changed, devicePanel, numberControl } from "../device-controls"
import { EVENT_CHANGE, EVENT_CLICK } from "../../events/event-constants"

export { MAX_UNPAIRED_PEERS } from "../protocol-unpaired"

/** Random characters in a generated MIDI port secret: 60 bits, beyond practical guessing. */
export const MIDI_SECRET_LENGTH = 12

/** Groups of four, like pairing codes, keeping every character the transport uses. */
const formatSecret = (secret: string) =>
	(normalizeSecret(secret).match(/.{1,4}/gu) ?? []).join("-")

const portOption = (name: string) => {
	const option = document.createElement("option")
	option.value = option.textContent = name
	return option
}

/**
 * Application control, MIDI commands and WebMidiLink MIDI, listening by default. With
 * `acceptUnpaired: false`, connections require an explicitly attached application; otherwise
 * those sessions are shared by every Input that accepts them, so each command executes once.
 *
 * Set `midiPort` (with optional `midiRoom` and `midiSecret`) to also listen on a loopback MIDI
 * port, for applications that cannot reach this window, such as cross-origin isolated pages that
 * use SharedArrayBuffer. With a secret, the port is encrypted and only its holder is heard.
 */
export default class InputProtocol extends AbstractInput {
	readonly requiresConnectionControl = false
	private target?: Window
	private origin?: string
	private requiredCode?: string
	private peer?: Peer
	private midiPortPeer?: Peer
	private midiPortError?: string
	private midiAccess?: Promise<MidiAccessLike>
	private leaveUnpaired?: () => void
	private midiState = new ProtocolMidiState()
	private midiPortState = new ProtocolMidiState()
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
		return "Receive application commands and MIDI from other applications"
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
	/** The connection listening on a MIDI port, when `midiPort` is set. */
	get midiPortConnection(): Peer | undefined {
		return this.midiPortPeer
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
		super({ acceptUnpaired: true, now: () => performance.now() / 1000, ...options })
		if ((this.options.acceptUnpaired || this.options.midiPort) && this.options.autoConnect !== false) {
			void this.connect().catch((error) => this.report(error, "connect"))
		}
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
	private createPeer(
		transport: Transport,
		state: ProtocolMidiState,
		options: { requirePairingCode?: string; onAuthorized?: () => void; onClosed: () => void }
	): Peer {
		const commands = new LayeredRegistry(this.registry)
		registerMidiCommands(commands, (bytes) =>
			this.receivePacket({ format: "midi", data: bytes }, state)
		)
		return new Peer(transport, {
			identity: this.identity,
			registry: commands,
			getPatch: this.options.getPatch,
			setPatch: this.options.setPatch,
			ump: true,
			...options,
			onError: (error, context) => this.report(error, context),
			onMidi: (bytes) => this.receivePacket({ format: "midi", data: Array.from(bytes) }, state),
			onUmp: (words) => this.receivePacket({ format: "ump", data: words }, state)
		})
	}
	private createPairedPeer(target: Window, origin: string): Peer {
		const peer: Peer = this.createPeer(windowTransport(target, origin), this.midiState, {
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
			}
		})
		return peer
	}
	private requestMidiAccess(): Promise<MidiAccessLike> {
		const request: ((options: { sysex: boolean }) => Promise<MidiAccessLike>) | undefined =
			this.options.requestMIDIAccess ??
			(navigator as any).requestMIDIAccess?.bind(navigator)
		if (!request) {
			return Promise.reject(new Error("This browser has no Web MIDI"))
		}
		// Protocol messages travel as SysEx, so the port needs SysEx permission.
		this.midiAccess ??= request({ sysex: true }).catch((error: unknown) => {
			this.midiAccess = undefined
			throw error
		})
		return this.midiAccess
	}
	/** Names of MIDI ports with an input and an output of the same name, such as loopback ports. */
	async midiPortNames(): Promise<string[]> {
		const access = await this.requestMidiAccess()
		const names = [...access.outputs.values()].map((port) => port.name ?? "")
		return names.filter(
			(name, index) => name && names.indexOf(name) === index && findMidiPort(access, name)
		)
	}
	/** Listens on the configured MIDI port; failures are shown in the status, not thrown. */
	private async openMidiPort(generation: number): Promise<void> {
		const name: string = this.options.midiPort
		this.midiPortError = undefined
		try {
			const access = await this.requestMidiAccess()
			const port = findMidiPort(access, name)
			if (!port) {
				throw new Error(`MIDI port "${name}" was not found`)
			}
			if (generation !== this.generation) {
				return
			}
			const secret = this.midiSecret
			const transport = midiTransport(port.input, port.output, {
				room: this.options.midiRoom ?? 0,
				secret: secret || undefined
			})
			const releaseNotes = () => {
				for (const release of this.midiPortState.release()) {
					this.dispatchPacket(release)
				}
			}
			const peer: Peer = this.createPeer(
				{
					send: (message) => transport.send(message),
					// A new connection, such as a reloaded application taking over without saying
					// goodbye, releases the notes the previous one held.
					listen: (receive) =>
						transport.listen((message) => {
							if (typeof message === "string" && isInitializeRequest(message)) {
								releaseNotes()
							}
							receive(message)
						})
				},
				this.midiPortState,
				// Keep listening: the other application may reconnect, for example after a reload.
				{ onClosed: releaseNotes }
			)
			this.midiPortPeer = peer
		} catch (error) {
			if (generation === this.generation) {
				this.midiPortError = error instanceof Error ? error.message : String(error)
				this.report(error, "MIDI port")
			}
		}
	}
	private get midiSecret(): string {
		return normalizeSecret(String(this.options.midiSecret ?? ""))
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
		if ((!this.target || !this.origin) && !unpaired && !this.options.midiPort) {
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
		// Only wait when there is a port, so window connections start synchronously as before.
		if (this.options.midiPort) {
			await this.openMidiPort(generation)
			if (generation !== this.generation) {
				return
			}
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
			? `Listening for connections (${unpairedSessionCount()} connected).`
			: ""
		const port = this.midiPortError
			? `MIDI port: ${this.midiPortError}.`
			: this.midiPortPeer
				? this.midiSecret
					? `Listening on MIDI port ${this.options.midiPort}, encrypted with secret ${formatSecret(this.midiSecret)}.`
					: `Listening on MIDI port ${this.options.midiPort} without a secret: anything on the port can read and send.`
				: ""
		return [paired, unpaired, port].filter(Boolean).join(" ")
	}
	private updateStatus(): void {
		if (this.status) {
			this.status.textContent = this.isConnected
				? this.connectedStatus()
				: "Pair an application in advanced connection settings, then connect."
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
		this.midiPortPeer?.close()
		this.midiPortPeer = undefined
		this.leaveUnpaired?.()
		this.leaveUnpaired = undefined
		for (const session of this.sessionStates.keys()) {
			this.endSession(session)
		}
		for (const state of [this.midiState, this.midiPortState]) {
			for (const release of state.release()) {
				this.dispatchPacket(release)
			}
		}
		this.setAsDisconnected()
		this.updateStatus()
	}
	/** Applies changed settings to a running connection, or starts one when asked. */
	private reconnect(start: boolean): void {
		const wasConnected = this.isConnected
		void this.disconnect()
		// Any later disconnect, connect or destroy changes the generation and cancels this.
		const generation = this.generation
		const possible = Boolean(this.target || this.options.acceptUnpaired || this.options.midiPort)
		if ((wasConnected || start) && possible) {
			queueMicrotask(() => {
				if (generation === this.generation && !this.destroyed) {
					this.connect().catch((error) => {
						if (this.status) {
							this.status.textContent = error instanceof Error ? error.message : String(error)
						}
					})
				}
			})
		}
	}
	private createMidiPortGui(): HTMLElement {
		const fieldset = document.createElement("fieldset")
		const legend = document.createElement("legend")
		legend.textContent = "MIDI port connection"
		const help = document.createElement("small")
		help.textContent =
			"For applications that cannot open or embed this window, such as ones isolated for SharedArrayBuffer. Both choose the same loopback port (loopMIDI, IAC Driver), room and secret."
		const portLabel = document.createElement("label")
		const port = document.createElement("select")
		const current = this.options.midiPort as string | undefined
		if (current) {
			port.append(portOption(current))
		}
		portLabel.append("Port ", port)
		const find = document.createElement("button")
		find.type = "button"
		find.textContent = "Find MIDI ports"
		find.addEventListener(EVENT_CLICK, async () => {
			try {
				const names = await this.midiPortNames()
				port.replaceChildren(...names.map(portOption))
				if (current && names.includes(current)) {
					port.value = current
				}
				if (!names.length && this.status) {
					this.status.textContent =
						"No port has an input and an output with the same name. Create a loopback port and try again."
				}
			} catch (error) {
				if (this.status) {
					this.status.textContent = error instanceof Error ? error.message : String(error)
				}
			}
		})
		fieldset.append(legend, help, portLabel, find)
		let room = Number(this.options.midiRoom ?? 0)
		numberControl(fieldset, "Room", room, 0, 127, (value) => (room = value))
		const secretLabel = document.createElement("label")
		const secret = document.createElement("input")
		secret.autocomplete = "off"
		secret.spellcheck = false
		secret.value = this.options.midiSecret
			? formatSecret(this.options.midiSecret)
			: formatPairingCode(generatePairingCode(MIDI_SECRET_LENGTH))
		secretLabel.append("Secret ", secret)
		const regenerate = document.createElement("button")
		regenerate.type = "button"
		regenerate.textContent = "New secret"
		regenerate.addEventListener(EVENT_CLICK, () => {
			secret.value = formatPairingCode(generatePairingCode(MIDI_SECRET_LENGTH))
		})
		const use = document.createElement("button")
		use.type = "button"
		use.textContent = "Listen on this port"
		use.addEventListener(EVENT_CLICK, () => {
			if (!port.value) {
				if (this.status) {
					this.status.textContent = "Find MIDI ports and choose one first."
				}
				return
			}
			this.options.midiPort = port.value
			this.options.midiRoom = room
			this.options.midiSecret = normalizeSecret(secret.value)
			changed(this)
			this.reconnect(true)
		})
		const stop = document.createElement("button")
		stop.type = "button"
		stop.textContent = "Stop listening on MIDI"
		stop.addEventListener(EVENT_CLICK, () => {
			delete this.options.midiPort
			changed(this)
			this.reconnect(false)
		})
		const warning = document.createElement("small")
		warning.textContent =
			"Type the same secret into the other application. Without a secret, any software using the port can read and send."
		fieldset.append(secretLabel, regenerate, warning, use, stop)
		return fieldset
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		this.gui = devicePanel()
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.updateStatus()
		const advanced = document.createElement("details")
		const summary = document.createElement("summary")
		summary.textContent = "Advanced connection settings"
		const pairing = document.createElement("div")
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
		pairing.hidden = unpaired.checked
		const connection = document.createElement("button")
		connection.type = "button"
		connection.textContent = "Connect paired application"
		connection.addEventListener(EVENT_CLICK, () => {
			void this.connect().catch((error) => {
				this.status!.textContent = error instanceof Error ? error.message : String(error)
			})
		})
		const warning = document.createElement("small")
		warning.textContent =
			"Applications that open or embed this window can send MIDI and application commands. Disable open connections to require pairing."
		unpaired.addEventListener(EVENT_CHANGE, () => {
			pairing.hidden = unpaired.checked
			this.options.acceptUnpaired = unpaired.checked
			changed(this)
			this.reconnect(unpaired.checked)
		})
		pairing.append(label, open, opener, connection)
		advanced.append(summary, unpairedLabel, warning, pairing, this.createMidiPortGui())
		this.gui.append(this.status, advanced)
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