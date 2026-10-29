import { EVENT_CONFIGURATION_CHANGED } from "../../event-constants.ts"
import { MidiOutputRouting } from "./midi-output-routing.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { IAudioOutput } from "./output-interface.ts"
import { midiToCommand } from "../../midi/midi-command-conversion.ts"
import {
	getNativeMidiBridge,
	type NativeMidiBridge,
	type NativeMidiDevice
} from "../../midi/native-midi-bridge.ts"
import { midiBytesToUmp } from "../../midi/ump-codec.ts"

export const MIDI2_NATIVE_OUTPUT_ID = "MIDI 2.0 Native"

export default class OutputMIDI2Native extends EventTarget implements IAudioOutput {
	static ID = 0
	readonly uuid = "Output-MIDI2Native-" + OutputMIDI2Native.ID++
	readonly options: Record<string, any>
	#bridge?: NativeMidiBridge
	#devices: NativeMidiDevice[] = []
	#opened = new Set<number>()
	#connected = false
	#connecting?: Promise<void>
	#disconnecting?: Promise<void>
	#routing: MidiOutputRouting
	#perNote = false
	get name() {
		return MIDI2_NATIVE_OUTPUT_ID
	}
	get description() {
		return "Native MIDI 2.0 UMP output via Windows MIDI Services or CoreMIDI"
	}
	get isConnected() {
		return this.#connected
	}
	get isHidden() {
		return false
	}
	constructor(options: Record<string, any> = {}) {
		super()
		this.options = { channels: -1, ...options }
		this.#routing = new MidiOutputRouting(
			this.options,
			() =>
				this.#devices.map((device) => ({
					id: String(device.index),
					registryId: device.id,
					name: device.name
				})),
			(id, bytes) => this.#sendWords(id, midiBytesToUmp(bytes)),
			() => this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED)),
			(id, words) => this.#sendWords(id, words)
		)
	}
	async #sendWords(id: string, words: number[]) {
		if (!this.#connected || !this.#bridge) {
			throw new Error("Native MIDI output is disconnected")
		}
		const index = Number(id)
		if (!this.#opened.has(index)) {
			await this.#bridge.openUmpOutput(index)
			this.#opened.add(index)
		}
		await this.#bridge.sendUmp(index, words)
	}
	sendUmp(words: number[]) {
		return this.#routing.sendPacket(words)
	}
	#voice(status: number, channel: number, group: number, data: number, value: number) {
		if (
			!Number.isInteger(channel) ||
			channel < 1 ||
			channel > 16 ||
			!Number.isInteger(group) ||
			group < 0 ||
			group > 15
		) {
			return Promise.reject(new Error("Invalid MIDI channel or group"))
		}
		if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
			return Promise.reject(new Error("Invalid MIDI 2.0 value"))
		}
		return this.sendUmp([
			(0x40000000 | (group << 24) | (status << 20) | ((channel - 1) << 16) | data) >>> 0,
			value
		])
	}
	noteOn16(note: number, velocity: number, channel = 1, group = 0) {
		if (
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isInteger(velocity) ||
			velocity < 0 ||
			velocity > 65535
		) {
			return Promise.reject(new Error("Invalid MIDI 2.0 note or velocity"))
		}
		return this.#voice(9, channel, group, note << 8, (velocity << 16) >>> 0)
	}
	noteOff16(note: number, velocity = 0, channel = 1, group = 0) {
		if (
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isInteger(velocity) ||
			velocity < 0 ||
			velocity > 65535
		) {
			return Promise.reject(new Error("Invalid MIDI 2.0 note or velocity"))
		}
		return this.#voice(8, channel, group, note << 8, (velocity << 16) >>> 0)
	}
	sendControlChange32(controller: number, value: number, channel = 1, group = 0) {
		if (!Number.isInteger(controller) || controller < 0 || controller > 127) {
			return Promise.reject(new Error("Invalid controller"))
		}
		return this.#voice(11, channel, group, controller << 8, value)
	}
	sendPitchBend32(value: number, channel = 1, group = 0) {
		return this.#voice(14, channel, group, 0, value)
	}
	sendPerNoteController32(
		note: number,
		controller: number,
		value: number,
		channel = 1,
		group = 0,
		registered = false
	) {
		if (!this.#connected || !this.#perNote) {
			return Promise.reject(
				new Error("Per-note controllers require a native MIDI 2.0 transport")
			)
		}
		if (![note, controller].every((n) => Number.isInteger(n) && n >= 0 && n <= 127)) {
			return Promise.reject(new Error("Invalid note or controller"))
		}
		return this.#voice(registered ? 0 : 1, channel, group, (note << 8) | controller, value)
	}

	createGui() {
		return this.#routing.createGui()
	}
	destroyGui() {
		return this.#routing.destroyGui()
	}
	getNoteKey(command: IAudioCommand) {
		return this.#routing.noteKey(command)
	}
	sendCommand(command: IAudioCommand) {
		return this.#routing.sendCommand(command)
	}
	async connect(): Promise<void> {
		if (this.#disconnecting) {
			await this.#disconnecting
		}
		if (this.#connected) {
			return
		}
		if (this.#connecting) {
			return this.#connecting
		}
		this.#connecting = (async () => {
			this.#bridge = getNativeMidiBridge()
			this.#devices = await this.#bridge.getUmpOutputs()
			this.#perNote = (await this.#bridge.getCapabilities()).perNoteCC
			if (this.options.selectedDevice == null && this.#devices[0]) {
				this.options.selectedDevice = String(this.#devices[0].index)
			}
			this.#routing.refresh()
			try {
				for (const device of this.#routing.targets()) {
					await this.#bridge.openUmpOutput(Number(device.id))
					this.#opened.add(Number(device.id))
				}
				this.#connected = true
			} catch (error) {
				await this.#closePorts()
				throw error
			}
		})()
		try {
			await this.#connecting
		} finally {
			this.#connecting = undefined
		}
	}
	async #closePorts() {
		const results = await Promise.allSettled(
			[...this.#opened].map((index) => this.#bridge!.closeUmpOutput(index))
		)
		this.#opened.clear()
		const failure = results.find((result) => result.status === "rejected")
		if (failure?.status === "rejected") {
			throw failure.reason
		}
	}
	async disconnect(): Promise<void> {
		if (this.#disconnecting) {
			return this.#disconnecting
		}
		this.#disconnecting = (async () => {
			if (this.#connecting) {
				await this.#connecting
			}
			try {
				await this.#routing.release()
			} finally {
				this.#connected = false
				this.#routing.clearActiveNotes()
				await this.#closePorts()
			}
		})()
		try {
			await this.#disconnecting
		} finally {
			this.#disconnecting = undefined
		}
	}
	getActiveNotes() {
		return this.#routing.getActiveNotes()
	}
	clearActiveNotes() {
		this.#routing.clearActiveNotes()
	}
	setChannel(channel: number | number[]) {
		this.#routing.setChannel(channel)
	}
	noteOn(note: number, velocity = 100, channel = 1) {
		return this.#routing.noteOn(note, velocity, channel)
	}
	noteOff(note: number, channel = 1) {
		return this.#routing.noteOff(note, channel)
	}
	#send(bytes: number[]) {
		const command = midiToCommand(bytes, performance.now(), this.uuid)
		return command ? this.sendCommand(command) : Promise.resolve()
	}
	allNotesOff(channel = 1) {
		return this.sendControlChange(123, 0, channel)
	}
	sendControlChange(controller: number, value: number, channel = 1) {
		return this.#send([0xb0 | (channel - 1), controller, value])
	}
	sendProgramChange(program: number, channel = 1) {
		return this.#send([0xc0 | (channel - 1), program])
	}
	sendPitchBend(value: number, channel = 1) {
		const bend = Math.max(0, Math.min(16383, Math.round(value)))
		return this.#send([0xe0 | (channel - 1), bend & 127, bend >> 7])
	}
	sendChannelAftertouch(pressure: number, channel = 1) {
		return this.#send([0xd0 | (channel - 1), pressure])
	}
	sendPolyphonicAftertouch(note: number, pressure: number, channel = 1) {
		return this.#send([0xa0 | (channel - 1), note, pressure])
	}
	sendPerNoteController(note: number, controller: number, value: number, channel = 1) {
		return this.sendPerNoteController32(
			note,
			controller,
			Math.round((Math.max(0, Math.min(127, value)) / 127) * 0xffffffff),
			channel
		)
	}
	getAvailableDevices() {
		return [...this.#devices]
	}
	async selectDevice(index: number) {
		if (!this.#devices.some((device) => device.index === index)) {
			throw new Error("Device index out of range")
		}
		await this.#routing.release()
		this.#routing.setOutput(String(index))
	}
	hasMidiOutput() {
		return true
	}
	hasAudioOutput() {
		return false
	}
	hasAutomationOutput() {
		return false
	}
	hasMpeOutput() {
		return this.#perNote
	}
	hasOscOutput() {
		return false
	}
	hasSysexOutput() {
		return this.#perNote
	}
	async destroy() {
		try {
			await this.disconnect()
		} finally {
			await this.destroyGui()
		}
	}
}