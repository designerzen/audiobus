import { EVENT_CONFIGURATION_CHANGED, EVENT_MIDIMESSAGE, EVENT_DEVICE_LIST_CHANGED, EVENT_MIDI_CHANNELS_CHANGED } from '../../event-constants.ts'
import { midiToCommand } from '../../midi/midi-command-conversion.ts'
import AbstractInput from "./abstract-input.ts"
import { createAudioCommand } from "../../audio-command-factory.ts"
import type { Input } from "webmidi"
import { sharedWebMidi, type WebMidiDeviceChange } from '../../midi/shared-webmidi'
import { NOTE_OFF, NOTE_ON } from '../../commands'
import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"
import { acceptsMidiInput, createMidiInputControls, selectedMidiDevice } from './midi-input-controls.ts'
import type { IAudioInput } from "./input-interface.ts"

export const WEBMIDI_INPUT_ID = "WebMIDI"

export default class InputWebMIDIDevice extends AbstractInput implements IAudioInput {
    #release?: () => void
    #connecting?: Promise<void>
    #destroyed = false
    #abort = new AbortController()
    #unregister: () => void
    #webMIDIEnabled = false
    #gui?: ReturnType<typeof createMidiInputControls>
    #sustain = new Map<string, { deviceId: string; channel: number }>()
    #activeNotes = new Map<string, { note: number; channel: number; deviceId: string }>()

    get name(): string { return this.options?.deviceName ?? WEBMIDI_INPUT_ID }
    get description(): string { return 'WebMIDI' }
    get isEnabled(): boolean { return this.#webMIDIEnabled }
    get inputDevices(): Input[] { return sharedWebMidi.inputs.filter(device => acceptsMidiInput(this.options, device.id, 0)) }
    get midiInput() { return this }
    hasMidiInput(): boolean { return true }

    constructor(options: Record<string, any> = {}) {
        super({ channels: ALL_MIDI_CHANNELS, devices: [], ...options })
        const selected = selectedMidiDevice(this.options)
        this.options.selectedDevice = selected ?? ''
        this.options.listenToAllDevices = selected === null
        this.options.devices = selected === null ? [] : [selected]
        this.options.selectedChannel ??= Array.isArray(this.options.channels) ? (this.options.channels.length === 1 ? this.options.channels[0] : 0) : this.options.channels ?? 0
        this.#unregister = sharedWebMidi.registerInput(this, id => acceptsMidiInput(this.options, id, 0), () => this.#webMIDIEnabled && this.isConnected)
        sharedWebMidi.addEventListener(EVENT_MIDIMESSAGE, ((event: CustomEvent) => {
            this.onMIDIEvent(event.detail.event, event.detail.device, event.detail.device.name, 0)
        }) as EventListener, { signal: this.#abort.signal })
        sharedWebMidi.addEventListener(EVENT_DEVICE_LIST_CHANGED, ((event: CustomEvent<WebMidiDeviceChange>) => {
            const detail = event.detail
            if (detail.disconnected && detail.device?.type === 'input') this.releaseNotes(detail.device.id, event)
            this.syncConnection()
            this.#gui?.refresh()
            this.dispatchEvent(new CustomEvent(EVENT_DEVICE_LIST_CHANGED, { detail }))
        }) as EventListener, { signal: this.#abort.signal })
        sharedWebMidi.addEventListener(EVENT_MIDI_CHANNELS_CHANGED, () => this.#gui?.refresh(), { signal: this.#abort.signal })
    }

    async connect(): Promise<void> {
        if (this.#webMIDIEnabled) return
        if (this.#connecting) return this.#connecting
        this.#connecting = (async () => {
            const release = await sharedWebMidi.acquire()
            if (this.#destroyed) { release(); return }
            this.#release = release
            this.#webMIDIEnabled = true
            this.syncConnection()
            this.#gui?.refresh()
        })()
        try { await this.#connecting } finally { this.#connecting = undefined }
    }

    async disconnect(): Promise<void> {
        if (this.#connecting) await this.#connecting.catch(() => {})
        this.releaseNotes()
        this.#webMIDIEnabled = false
        this.setAsDisconnected()
        this.#release?.(); this.#release = undefined
        this.#gui?.refresh()
    }

    async createGui(): Promise<HTMLElement> {
        if (!this.#gui) this.#gui = createMidiInputControls(this.options,
            () => sharedWebMidi.inputs.map(device => ({ id: device.id, name: [device.manufacturer, device.name].filter(Boolean).join(' ') || device.id, activeChannels: sharedWebMidi.observedChannels(device.id) })),
            () => {
                this.releaseNotes()
                this.syncConnection()
                this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
            })
        return this.#gui.element
    }

    async destroyGui(): Promise<void> {
        this.#gui?.destroy()
        this.#gui = undefined
    }

    private syncConnection() {
        if (this.#webMIDIEnabled && (selectedMidiDevice(this.options) === null || this.inputDevices.length > 0)) this.setAsConnected()
        else this.setAsDisconnected()
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
            this.dispatch(command, event.message ?? event)
            return
        }
        const channel = event.message?.channel ?? event.channel
        if (!acceptsMidiInput(this.options, device.id, channel)) return
        const status = ({ noteon: 0x90, noteoff: 0x80, controlchange: 0xb0 } as Record<string, number>)[event.type]
        if (status) this.onMIDIEvent({ data: [status | (channel - 1), event.note?.number ?? event.controller?.number,
            event.rawVelocity ?? event.rawValue ?? Math.round((event.velocity ?? event.value ?? 0) * 127)] }, device, _deviceName, _index)
    }

    private releaseNotes(deviceId?: string, origin?: object): void {
        const release = (data: number[], source: string) => {
            const command = midiToCommand(data, this.now, source)!
            if (origin) this.dispatch(command, origin)
            else this.dispatch(command)
        }
        for (const [key, active] of this.#sustain) {
            if (deviceId !== undefined && active.deviceId !== deviceId) continue
            release([0xb0 | (active.channel - 1), 64, 0], active.deviceId)
            this.#sustain.delete(key)
        }
        for (const [key, active] of this.#activeNotes) {
            if (deviceId !== undefined && active.deviceId !== deviceId) continue
            release([0x80 | (active.channel - 1), active.note, 0], active.deviceId)
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

    async destroy(): Promise<void> {
        this.#destroyed = true
        await this.disconnect()
        this.#abort.abort(); this.#unregister()
        await this.destroyGui()
    }
}

