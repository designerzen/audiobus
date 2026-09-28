import { midiToCommand } from '../../midi/midi-command-conversion.ts'
import AbstractInput from "./abstract-input.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"
import { WebMidi, type Input } from "webmidi"
import { NOTE_OFF, NOTE_ON } from '../../commands'
import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"
import { acceptsMidiInput, createMidiInputControls } from './midi-input-controls.ts'
import type { IAudioInput } from "./input-interface.ts"

export const WEBMIDI_INPUT_ID = "WebMIDI"

export default class InputWebMIDIDevice extends AbstractInput implements IAudioInput {
    #subscriptions = new Map<Input, () => void>()
    #webMIDIEnabled = false
    #gui?: ReturnType<typeof createMidiInputControls>
    #sustain = new Map<string, { deviceId: string; channel: number }>()
    #activeNotes = new Map<string, { note: number; channel: number; deviceId: string }>()
    #deviceChangeHandler = (event: any) => this.onDeviceStateChange(event)

    get name(): string { return WEBMIDI_INPUT_ID }
    get description(): string { return 'WebMIDI' }
    get isEnabled(): boolean { return this.#webMIDIEnabled }
    get inputDevices(): Input[] { return [...this.#subscriptions.keys()] }
    hasMidiInput(): boolean { return true }

    constructor(options: Record<string, any> = {}) {
        super({ channels: ALL_MIDI_CHANNELS, devices: [], ...options })
    }

    async connect(): Promise<void> {
        if (this.#webMIDIEnabled) return
        await WebMidi.enable({ sysex: true })
        this.#webMIDIEnabled = true
        WebMidi.addListener('connected', this.#deviceChangeHandler)
        WebMidi.addListener('disconnected', this.#deviceChangeHandler)
        WebMidi.inputs.forEach((device, index) => this.connectToMIDIDevice(device, index))
        this.setAsConnected()
        this.#gui?.refresh()
    }

    async disconnect(): Promise<void> {
        WebMidi.removeListener('connected', this.#deviceChangeHandler)
        WebMidi.removeListener('disconnected', this.#deviceChangeHandler)
        this.releaseNotes()
        for (const device of this.inputDevices) this.disconnectFromMIDIDevice(device)
        this.#webMIDIEnabled = false
        this.setAsDisconnected()
        this.#gui?.refresh()
    }

    async createGui(): Promise<HTMLElement> {
        if (!this.#gui) this.#gui = createMidiInputControls(this.options,
            () => WebMidi.inputs.map(device => ({ id: device.id, name: [device.manufacturer, device.name].filter(Boolean).join(' ') || device.id })),
            () => {
                this.releaseNotes()
                this.dispatchEvent(new Event('configurationChanged'))
            })
        return this.#gui.element
    }

    async destroyGui(): Promise<void> {
        this.#gui?.destroy()
        this.#gui = undefined
    }

    connectToMIDIDevice(device: Input, index: number): () => void {
        const existing = this.#subscriptions.get(device)
        if (existing) return existing
        const proxy = (event: any) => this.onMIDIEvent(event, device, device.name, index)
        device.addListener('midimessage', proxy)
        const unsubscribe = () => { device.removeListener('midimessage', proxy) }
        this.#subscriptions.set(device, unsubscribe)
        return unsubscribe
    }

    disconnectFromMIDIDevice(device: Input): void {
        this.releaseNotes(device.id)
        this.#subscriptions.get(device)?.()
        this.#subscriptions.delete(device)
        // WebMidi ports are shared by every input instance. Only remove our listener.
    }

    onMIDIEvent(event: any, device: Input, _deviceName: string, _index: number): void {
        if (!this.#webMIDIEnabled) return
        const data = event.message?.data ?? event.data
        if (data) {
            const command = midiToCommand(data, this.now, device.id)
            if (!command || !acceptsMidiInput(this.options, device.id, command.channel)) return
            const key = `${device.id}:${command.channel}:${command.number}`
            if (command.type === NOTE_ON) this.#activeNotes.set(key, { note: command.number, channel: command.channel, deviceId: device.id })
            else if (command.type === NOTE_OFF) this.#activeNotes.delete(key)
            if ((data[0] >> 4) === 0xb && data[1] === 64) {
                const pedal = `${device.id}:${command.channel}`
                if (data[2] >= 64) this.#sustain.set(pedal, { deviceId: device.id, channel: command.channel })
                else this.#sustain.delete(pedal)
            }
            this.dispatch(command)
            return
        }
        const channel = event.message?.channel ?? event.channel
        if (!acceptsMidiInput(this.options, device.id, channel)) return
        const status = ({ noteon: 0x90, noteoff: 0x80, controlchange: 0xb0 } as Record<string, number>)[event.type]
        if (status) this.onMIDIEvent({ data: [status | (channel - 1), event.note?.number ?? event.controller?.number,
            event.rawVelocity ?? event.rawValue ?? Math.round((event.velocity ?? event.value ?? 0) * 127)] }, device, _deviceName, _index)
    }

    private releaseNotes(deviceId?: string): void {
        for (const [key, active] of this.#sustain) {
            if (deviceId !== undefined && active.deviceId !== deviceId) continue
            this.dispatch(midiToCommand([0xb0 | (active.channel - 1), 64, 0], this.now, active.deviceId)!)
            this.#sustain.delete(key)
        }
        for (const [key, active] of this.#activeNotes) {
            if (deviceId !== undefined && active.deviceId !== deviceId) continue
            this.onNoteOff(active.note, active.channel)
            this.#activeNotes.delete(key)
        }
    }

    onNoteOn(noteNumber: number, velocity: number, channel: number): void {
        const command = createAudioCommand(NOTE_ON, noteNumber, this.now, this.name)
        command.velocity = velocity
        command.channel = channel
        this.dispatch(command)
    }

    onNoteOff(noteNumber: number, channel: number): void {
        const command = createAudioCommand(NOTE_OFF, noteNumber, this.now, this.name)
        command.velocity = 0
        command.channel = channel
        this.dispatch(command)
    }

    onControlChange(_controlNumber: number, _value: number, _channel: number): void {
        // CC command conversion is not yet supported by this adapter.
    }

    private onDeviceStateChange(event: any): void {
        if (event.port?.type === 'input') {
            if (event.type === 'connected') this.connectToMIDIDevice(event.port, WebMidi.inputs.indexOf(event.port))
            else if (event.type === 'disconnected') this.disconnectFromMIDIDevice(event.port)
        }
        this.#gui?.refresh()
        this.dispatchEvent(new CustomEvent('deviceListChanged', { detail: { inputs: WebMidi.inputs, device: event.port } }))
    }

    async destroy(): Promise<void> {
        await this.disconnect()
        await this.destroyGui()
    }
}

