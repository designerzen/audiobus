/**
 * This is a BLE MIDI Device output adapter
 * that takes audio commands and converts them
 * into BLE MIDI messages and sends them to a connected device
 */
import {
	sendBLENoteOn, sendBLENoteOff,
	sendBLEControlChange, sendBLEProgramChange,
	sendBLEPolyphonicAftertouch, sendBLEChannelAftertouch,
	sendBLEPitchBend, sendBLEAllNoteOff
} from "../../midi/midi-ble/midi-ble.ts"
import { 
	BLE_SERVICE_UUID_DEVICE_INFO, 
	BLE_SERVICE_UUID_MIDI 
} from "../../midi/midi-ble/ble-constants.ts"

import type { IAudioOutput } from "./output-interface.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import { connectToBLEDevice, disconnectBLEDevice, describeDevice } from "../../midi/midi-ble/ble-connection.ts"

export const BLE_OUTPUT_ID = "BLE MIDI"

export default class OutputBLEMIDIDevice extends EventTarget implements IAudioOutput {
	
	static ID:number = 0
	
	#uuid:string

	#bluetoothDevice: BluetoothDevice | undefined
	#bluetoothMIDICharacteristic: BluetoothRemoteGATTCharacteristic | undefined
	#selectedMIDIChannel: number = 1
	#packetQueue: Array<number> = []

	#activeNotes: Map<number, number> = new Map()
	
	#bluetoothWatchUnsubscribes: any

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return BLE_OUTPUT_ID
	}

	get description(): string {
		return "Bluetooth MIDI"
	}

	get isConnected(): boolean {
		return this.#bluetoothMIDICharacteristic !== undefined
	}

	constructor(characteristic?: BluetoothRemoteGATTCharacteristic, channel: number = 1) {
		super()
		this.#uuid = "Output-BLE-MIDI--"+(OutputBLEMIDIDevice.ID++)
		if (characteristic)
		{
			this.setCharacteristic(characteristic)
		}else{
			console.error("[BLE Output] No characteristic provided")
		}
		this.#selectedMIDIChannel = channel
	}

	hasMidiOutput(): boolean {
		return true
	}
	hasAudioOutput(): boolean {
		return false
	}
	hasAutomationOutput(): boolean {
		return false
	}
	hasMpeOutput(): boolean {
		return false
	}
	hasOscOutput(): boolean {
		return false
	}
	hasSysexOutput(): boolean {
		return false
	}

	/**
	 * 
	 * @returns 
	 */
	async connect(): Promise<void> {
		try {
			const result = await connectToBLEDevice()

			if (!result || !result.characteristic) {
				throw new Error("No BLE MIDI characteristic found on device")
			}

			this.setCharacteristic(result.characteristic)
			this.#bluetoothDevice = result.device
		
			console.info("[BLE Input] Device connected", describeDevice(this.#bluetoothDevice))

			return

		} catch (error: any) {
			console.error("[BLE Input] Connection failed", error)
			throw error
		}
	}

	/**
	 * Disconnect from the BLE MIDI device
	 */
	async disconnect(): Promise<void> {
		if (this.#bluetoothDevice) {
			disconnectBLEDevice(this.#bluetoothDevice)
		}
		this.#bluetoothDevice = undefined
		this.#bluetoothMIDICharacteristic = undefined
		return
	}

	/**
	 * Set the BLE characteristic for sending MIDI data
	 */
	setCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): void {
		this.#bluetoothMIDICharacteristic = characteristic
	}

	/**
	 * Set the MIDI channel for outgoing messages (1-16)
	
	setChannel(channel: number): void {
		if (channel >= 1 && channel <= 16) {
			this.#selectedMIDIChannel = channel
		}else{
			throw Error("Invalid MIDI channel number")
		}
	}
	*/

	/**
	 * Send Note On message to BLE MIDI device
	 */
	noteOn(noteNumber: number, velocity: number = 127): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Note On", this)
			return
		}

		this.#activeNotes.set(noteNumber, velocity)

		sendBLENoteOn(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			noteNumber,
			velocity,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Note On sent", {
				note: noteNumber,
				velocity,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Note On", {
				note: noteNumber,
				velocity,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Note Off message to BLE MIDI device
	 */
	noteOff(noteNumber:number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Note Off", this)
			return
		}

		this.#activeNotes.delete(noteNumber)

		sendBLENoteOff(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			noteNumber,
			0,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Note Off sent", {
				note: noteNumber,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Note Off", {
				note: noteNumber,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send All Notes Off (CC#123) to clear all active notes
	 */
	allNotesOff(): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for All Notes Off")
			return
		}

		sendBLEAllNoteOff(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			123,
			0,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] All Notes Off sent", {
				channel: this.#selectedMIDIChannel,
				result
			})
			this.#activeNotes.clear()
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send All Notes Off", {
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Control Change message
	 */
	sendControlChange(controlNumber: number, value: number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Control Change")
			return
		}

		sendBLEControlChange(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			controlNumber,
			value,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Control Change sent", {
				controlNumber,
				value,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Control Change", {
				controlNumber,
				value,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Program Change message
	 */
	sendProgramChange(program: number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Program Change")
			return
		}

		sendBLEProgramChange(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			program,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Program Change sent", {
				program,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Program Change", {
				program,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Polyphonic Aftertouch (Key Pressure)
	 */
	sendPolyphonicAftertouch(note: number, pressure: number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Polyphonic Aftertouch")
			return
		}

		sendBLEPolyphonicAftertouch(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			note,
			pressure,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Polyphonic Aftertouch sent", {
				note,
				pressure,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Polyphonic Aftertouch", {
				note,
				pressure,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Channel Aftertouch (Channel Pressure)
	 */
	sendChannelAftertouch(pressure: number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Channel Aftertouch")
			return
		}

		sendBLEChannelAftertouch(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			pressure,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Channel Aftertouch sent", {
				pressure,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Channel Aftertouch", {
				pressure,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Send Pitch Bend message
	 */
	sendPitchBend(lsb: number, msb: number): void {
		if (!this.#bluetoothMIDICharacteristic) {
			console.warn("[BLE Output] No characteristic available for Pitch Bend")
			return
		}

		sendBLEPitchBend(
			this.#bluetoothMIDICharacteristic,
			this.#selectedMIDIChannel,
			lsb,
			msb,
			this.#packetQueue
		)
		.then((result) => {
			console.info("[BLE Output] Pitch Bend sent", {
				lsb,
				msb,
				channel: this.#selectedMIDIChannel,
				result
			})
		})
		.catch((err) => {
			console.error("[BLE Output] Failed to send Pitch Bend", {
				lsb,
				msb,
				channel: this.#selectedMIDIChannel,
				error: err && err.message ? err.message : String(err)
			})
		})
	}

	/**
	 * Clear all active notes tracking
	 */
	clearActiveNotes(): void {
		this.#activeNotes.clear()
	}

	/**
	 * Disconnect and cleanup
	 */
	async destroy(): Promise<void> {
		await this.disconnect()
		this.allNotesOff()
		this.#activeNotes.clear()
	}
}

