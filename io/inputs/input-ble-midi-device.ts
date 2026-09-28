import { midiToCommand } from '../../midi/midi-command-conversion.ts'
import { BleMidiDecoder } from '../../midi/midi-ble/ble-midi-decoder.ts'
/**
 * This is a BLE MIDI Device adapter
 * that takes BLE MIDI events and converts them
 * into AudioCommands and dispatches them
 */

import { acceptsMidiInput, createMidiInputControls } from './midi-input-controls.ts'
import AbstractInput from "./abstract-input.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"
import { NOTE_OFF, NOTE_ON } from '../../commands'
import {
    connectToBLEDevice, disconnectBLEDevice,
    watchCharacteristics, describeDevice
} from "../../midi/midi-ble/ble-connection.ts"
import { BLE_SERVICE_UUID_DEVICE_INFO, BLE_SERVICE_UUID_MIDI } from "../../midi/midi-ble/ble-constants.ts"

import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { IAudioInput } from "./input-interface.ts"

export const BLE_INPUT_ID = "BLE MIDI"

export default class InputBLEMIDIDevice extends AbstractInput implements IAudioInput{

    #bluetoothDevice: BluetoothDevice | null = null
    #bluetoothMIDICharacteristic: BluetoothRemoteGATTCharacteristic | undefined
    #bluetoothWatchUnsubscribes: Array<() => Promise<void>> = []
    #selectedMIDIChannel: number = 0
    #decoder = new BleMidiDecoder()
    #notes = new Map<string, { note: number; channel: number }>()
    #gui?: ReturnType<typeof createMidiInputControls>

    get name(): string {
        return BLE_INPUT_ID
    }

	get description():string {
		return "Bluetooth MIDI"
	}

    get isConnected(): boolean {
        return (super.isConnected && (this.#bluetoothDevice !== null ) && this.#bluetoothDevice.gatt?.connected) ?? false
    }

    get device(): BluetoothDevice | null {
        return this.#bluetoothDevice
    }

	get channel():number{
		return Number(this.options.selectedChannel ?? this.#selectedMIDIChannel)
	}

    constructor(options: Record<string, any> = {}) {
        super(options)
    }

    async createGui(): Promise<HTMLElement> {
        if (!this.#gui) this.#gui = createMidiInputControls(this.options,
            () => this.#bluetoothDevice ? [{ id: this.#bluetoothDevice.id, name: this.#bluetoothDevice.name ?? 'Bluetooth MIDI device' }] : [],
            () => { this.releaseNotes(); this.dispatchEvent(new Event('configurationChanged')) })
        return this.#gui.element
    }

    async destroyGui(): Promise<void> {
        this.#gui?.destroy()
        this.#gui = undefined
    }

    /**
     * Connect to a BLE MIDI device
     */
    async connect(): Promise<void> {
        try {
            const result = await connectToBLEDevice()

            if (!result || !result.characteristic) {
                throw new Error("No BLE MIDI characteristic found on device")
            }

            this.#bluetoothMIDICharacteristic = result.characteristic
            this.#bluetoothDevice = result.device
            this.#gui?.refresh()

            console.info("[BLE Input] Device connected", describeDevice(this.#bluetoothDevice))

            // Watch for incoming MIDI data
            const availableMIDIBluetoothCharacteristics = [
                {
                    uuid: this.#bluetoothMIDICharacteristic.uuid,
                    properties: this.#bluetoothMIDICharacteristic.properties,
                    characteristicRef: this.#bluetoothMIDICharacteristic
                }
            ]

            const unsubs = await watchCharacteristics(
                availableMIDIBluetoothCharacteristics,
                (capability, value) => {
                    this.onBLEMIDIDataReceived(value)
                }
            )

            this.#bluetoothWatchUnsubscribes = unsubs
			this.setAsConnected()

        } catch (error: any) {
            console.error("[BLE Input] Connection failed", error)
            throw error
        }
    }

    /**
     * Disconnect from the BLE MIDI device
     */
    async disconnect(): Promise<void> {
        this.releaseNotes()
        this.#decoder.reset()
        console.info("[BLE Input] Disconnecting from device...", {
            device: this.#bluetoothDevice?.name
        })

        // Unsubscribe from all characteristic watches
        for (const unsub of this.#bluetoothWatchUnsubscribes) {
            try {
                await unsub()
            } catch (err: any) {
                console.warn("[BLE Input] Error unsubscribing from characteristic:", err)
            }
        }

        // Disconnect the GATT server
        if (this.#bluetoothDevice) {
            disconnectBLEDevice(this.#bluetoothDevice)
        }

        // Clear references
        this.#bluetoothWatchUnsubscribes = []
        this.#bluetoothMIDICharacteristic = undefined
        this.#bluetoothDevice = null
        this.#gui?.refresh()

		this.setAsDisconnected()
    }

    /**
     * Set the MIDI channel for outgoing messages
     */
    setChannel(channel: number): void {
        if (Number.isInteger(channel) && channel >= 0 && channel <= 16) {
            this.#selectedMIDIChannel = channel
            this.options.selectedChannel = channel
        }else{
			throw new Error("Invalid MIDI channel #" + channel)
		}
    }

    /**
     * Handle incoming MIDI data from BLE characteristic
     */
    onBLEMIDIDataReceived(value: DataView): void {
        for (const bytes of this.#decoder.decode(value)) {
            const command = midiToCommand(bytes, this.now, this.#bluetoothDevice?.id ?? this.name)
            if (!command || !acceptsMidiInput(this.options, this.#bluetoothDevice?.id ?? '', command.channel)) continue
            const key = `${command.channel}:${command.number}`
            if (command.type === NOTE_ON) this.#notes.set(key, { note: command.number, channel: command.channel })
            else if (command.type === NOTE_OFF) this.#notes.delete(key)
            this.dispatch(command)
        }
    }

    private releaseNotes(): void {
        for (const note of this.#notes.values()) this.onNoteOff(note.note, note.channel)
        this.#notes.clear()
    }

    /**
     * Handle Note On event
     */
    onNoteOn(noteNumber: number, velocity: number, channel: number): void {
        const command: IAudioCommand = createAudioCommand(
            NOTE_ON,
            noteNumber,
            this.now,
            this.name
        )

        command.channel = channel
        command.velocity = velocity
        console.info("[BLE Input] Note On", { note: noteNumber, velocity, channel })
        this.dispatch(command)
    }

    /**
     * Handle Note Off event
     */
    onNoteOff(noteNumber: number, channel: number): void {
        const command: IAudioCommand = createAudioCommand(
            NOTE_OFF,
            noteNumber,
            this.now,
            this.name
        )

        command.channel = channel
        command.velocity = 0
        console.info("[BLE Input] Note Off", { note: noteNumber, channel })
        this.dispatch(command)
    }

    /**
     * Handle Control Change event
     */
    onControlChange(controlNumber: number, value: number, channel: number): void {
        console.info("[BLE Input] Control Change", { controlNumber, value, channel })
        // TODO: Implement CC handling if needed
    }

    /**
     * Handle Program Change event
     */
    onProgramChange(program: number, channel: number): void {
        console.info("[BLE Input] Program Change", { program, channel })
        // TODO: Implement PC handling if needed
    }

    /**
     * Cleanup when destroying the input
     */
    async destroy(): Promise<void> {
        await this.destroyGui()
        if (this.isConnected) {
            await this.disconnect()
        }
    }
}



