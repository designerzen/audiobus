import NoteInput from "./note-input"
import {
	CONTROL_CHANGE,
	MIDI_CLOCK,
	MIDI_CONTINUE,
	MIDI_START,
	MIDI_STOP,
	NOTE_OFF,
	NOTE_ON
} from "../../commands/commands"
import { changed, devicePanel } from "../device-controls"
import { decodeOSC, oscPrefix, oscToCommand } from "../osc"
import { OscConnection, oscControls } from "../osc-connection"
import { musicalCommand } from "../event-clip"

const TRANSPORT = [MIDI_CLOCK, MIDI_START, MIDI_STOP, MIDI_CONTINUE]

export default class InputOSC extends NoteInput {
	readonly requiresConnectionControl = true
	private connection: OscConnection
	private gui?: HTMLElement
	private status?: HTMLElement
	private channels = new Set<number>()
	get name() {
		return "OSC Bridge"
	}
	get description() {
		return "Receive notes and controllers from a binary OSC WebSocket bridge"
	}
	hasOscInput() {
		return true
	}
	/** Offered as a MIDI clock source, so a DAW plugin's transport can drive the app. */
	get clockPorts() {
		return [{ id: this.uuid, name: this.name }]
	}
	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.url = options.url ?? "ws://127.0.0.1:8080"
		this.options.prefix = oscPrefix(options.prefix ?? "/harmoneasy")
		this.connection = new OscConnection(
			(bytes) => {
				for (const message of decodeOSC(bytes)) {
					const command = oscToCommand(message, this.options.prefix, this.now, this.uuid)
					if (!command || !this.isConnected) {
						continue
					}
					if (command.type === NOTE_ON && command.velocity > 0) {
						this.noteOn(command.number, command.velocity, command.channel)
					} else if (command.type === NOTE_OFF || command.type === NOTE_ON) {
						this.noteOff(command.number, command.channel)
					} else if (TRANSPORT.includes(command.type)) {
						this.dispatch(command)
					} else {
						this.channels.add(command.channel)
						this.dispatch(command)
					}
				}
			},
			() => {
				this.release()
				this.setAsDisconnected()
				if (this.status) {
					this.status.textContent = "Disconnected"
				}
			},
			(message) => {
				if (this.status) {
					this.status.textContent = message
				}
			}
		)
	}
	private release(): void {
		this.allNotesOff()
		for (const channel of this.channels) {
			this.dispatch(
				musicalCommand({
					type: CONTROL_CHANGE,
					number: 64,
					value: 0,
					channel,
					from: this.uuid,
					startAt: this.now,
					time: this.now
				})
			)
		}
		this.channels.clear()
	}
	async connect(): Promise<void> {
		await this.connection.connect(this.options.url)
		if (this.connection.isConnected) {
			this.setAsConnected()
			if (this.status) {
				this.status.textContent = "Connected"
			}
		}
	}
	async disconnect(): Promise<void> {
		this.connection.disconnect()
		this.release()
		this.setAsDisconnected()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.textContent = this.isConnected ? "Connected" : "Connect to your OSC bridge."
		oscControls(
			panel,
			this.options,
			() => {
				void this.disconnect()
				changed(this)
			},
			this.status
		)
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
	}
	destroy(): void {
		void this.disconnect()
		void this.destroyGui()
	}
}