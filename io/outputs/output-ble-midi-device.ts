import { connectToBLEDevice, disconnectBLEDevice } from '../../midi/midi-ble/ble-connection.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { IAudioOutput } from './output-interface.ts'
import { MidiOutputRouting } from './midi-output-routing.ts'
import { CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND } from '../../commands'
import { CHANNEL_PRESSURE, POLYPHONIC_PRESSURE } from '../../midi/midi-command-conversion.ts'

export const BLE_OUTPUT_ID = 'BLE MIDI'

export default class OutputBLEMIDIDevice extends EventTarget implements IAudioOutput {
    static ID = 0
    readonly uuid = `Output-BLE-MIDI-${OutputBLEMIDIDevice.ID++}`
    readonly options: Record<string, any>
    private device?: BluetoothDevice
    private characteristic?: BluetoothRemoteGATTCharacteristic
    private routing: MidiOutputRouting

    constructor(optionsOrCharacteristic: Record<string, any> = {}, channel?: number) {
        super()
        const characteristic = typeof optionsOrCharacteristic.writeValue === 'function' ? optionsOrCharacteristic as BluetoothRemoteGATTCharacteristic : undefined
        this.options = characteristic ? { selectedChannel: channel ?? -1 } : { ...optionsOrCharacteristic }
        this.characteristic = characteristic
        this.device = characteristic?.service?.device
        this.routing = new MidiOutputRouting(this.options,
            () => this.characteristic ? [{ id: this.device?.id ?? 'bluetooth', name: this.device?.name ?? 'Bluetooth MIDI' }] : [],
            async (id, bytes) => {
                if (!this.characteristic || id !== (this.device?.id ?? 'bluetooth')) return
                const timestamp = Math.floor(performance.now()) & 8191
                const header = 0x80 | (timestamp >> 7)
                const low = 0x80 | (timestamp & 127)
                // SysEx may span BLE packets; the end marker has its own timestamp.
                const payload = bytes[0] === 0xf0 ? [...bytes.slice(0, -1), low, 0xf7] : bytes
                for (let offset = 0; offset < payload.length; offset += 18) {
                    await this.characteristic.writeValue(Uint8Array.from([header, low, ...payload.slice(offset, offset + 18)]))
                }
            }, () => this.dispatchEvent(new Event('configurationChanged')))
    }
    get name(): string { return BLE_OUTPUT_ID }
    get description(): string { return 'Sends MIDI messages to the selected device and channel' }
    get isConnected(): boolean { return this.characteristic !== undefined }
    get isHidden(): boolean { return false }
    async connect(): Promise<void> {
        if (this.isConnected) return
        const result = await connectToBLEDevice()
        if (!result?.characteristic) throw new Error('No BLE MIDI characteristic found')
        this.characteristic = result.characteristic
        this.device = result.device
        if (this.options.selectedDevice == null) this.options.selectedDevice = this.device.id
        this.routing.refresh()
    }
    setCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): void {
        this.characteristic = characteristic
        this.device = characteristic.service?.device
        this.routing.refresh()
    }
    async disconnect(): Promise<void> {
        await this.routing.release()
        if (this.device) disconnectBLEDevice(this.device)
        this.characteristic = undefined
        this.device = undefined
        this.routing.refresh()
    }
    setOutput(id: string): void { this.routing.setOutput(id) }
    setSendToAllDevices(all: boolean): void { this.setOutput(all ? '' : this.device?.id ?? 'bluetooth') }
    setChannel(channel: number | number[]): void { this.routing.setChannel(channel) }
    getNoteKey(command: IAudioCommand): string { return this.routing.noteKey(command) }
    sendCommand(command: IAudioCommand): Promise<void> { return this.routing.sendCommand(command) }
    noteOn(note: number, velocity = 127, channel = 1): Promise<void> { return this.routing.noteOn(note, velocity, channel) }
    noteOff(note: number, channel = 1): Promise<void> { return this.routing.noteOff(note, channel) }
    allNotesOff(): Promise<void> { return this.routing.release() }
    getActiveNotes(): Set<number> { return this.routing.getActiveNotes() }
    clearActiveNotes(): void { this.routing.clearActiveNotes() }
    private control(type: string, number: number, value: number, channel = 1): Promise<void> {
        return this.sendCommand({ type, number, value, channel } as IAudioCommand)
    }
    sendControlChange(number: number, value: number, channel = 1): Promise<void> { return this.control(CONTROL_CHANGE, number, value, channel) }
    sendProgramChange(program: number, channel = 1): Promise<void> { return this.control(PROGRAM_CHANGE, program, program, channel) }
    sendPitchBend(value: number, channel = 1): Promise<void> { return this.control(PITCH_BEND, 0, value, channel) }
    sendPolyphonicAftertouch(note: number, pressure: number, channel = 1): Promise<void> { return this.control(POLYPHONIC_PRESSURE, note, pressure, channel) }
    sendChannelAftertouch(pressure: number, channel = 1): Promise<void> { return this.control(CHANNEL_PRESSURE, 0, pressure, channel) }
    createGui(): Promise<HTMLElement> { return this.routing.createGui() }
    destroyGui(): Promise<void> { return this.routing.destroyGui() }
    hasMidiOutput(): boolean { return true }
    hasAudioOutput(): boolean { return false }
    hasAutomationOutput(): boolean { return false }
    hasMpeOutput(): boolean { return true }
    hasOscOutput(): boolean { return false }
    hasSysexOutput(): boolean { return true }
    async destroy(): Promise<void> { await this.disconnect(); await this.destroyGui() }
}
