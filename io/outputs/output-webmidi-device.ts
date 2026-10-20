import { EVENT_DEVICE_LIST_CHANGED, EVENT_CONFIGURATION_CHANGED, EVENT_CONNECTION_CHANGED, EVENT_READY } from '../../event-constants.ts'
import type { Output } from 'webmidi'
import { sharedWebMidi } from '../../midi/shared-webmidi'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { IAudioOutput } from './output-interface.ts'
import { MidiOutputRouting } from './midi-output-routing.ts'
import { CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND } from '../../commands'
import { CHANNEL_PRESSURE, POLYPHONIC_PRESSURE } from '../../midi/midi-command-conversion.ts'

export const WEBMIDI_OUTPUT_ID = 'WebMIDI'

export default class OutputWebMIDIDevice extends EventTarget implements IAudioOutput {
    static ID = 0
    readonly uuid = `Output-WebMIDI-${OutputWebMIDIDevice.ID++}`
    readonly options: Record<string, any>
    readonly requiresConnectionControl = false
    private destroyed = false
    private abort = new AbortController()
    private connected = false
    private releaseAccess?: () => void
    private connecting?: Promise<void>
    private routing: MidiOutputRouting
    private deviceChanged = () => {
        this.rememberDefault()
        this.routing.refresh()
        this.dispatchEvent(new Event(EVENT_DEVICE_LIST_CHANGED))
    }

    constructor(options: Record<string, any> = {}) {
        super()
        this.options = { ...options }
        if (options.midiOutput?.id && this.options.selectedDevice == null) this.options.selectedDevice = options.midiOutput.id
        this.routing = new MidiOutputRouting(this.options,
            () => this.outputDevices.map(device => ({ id: device.id, portName: device.name, manufacturer: device.manufacturer,
                name: [device.manufacturer, device.name].filter(Boolean).join(' ') || device.id })),
            (id, bytes) => {
                if (this.connected) sharedWebMidi.outputs.find(device => device.id === id)?.send(bytes)
            }, () => this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED)))
        const followSharedAccess = () => {
            if (this.options.autoConnect && !this.destroyed && sharedWebMidi.isReady) {
                void this.connect().catch(error => console.warn('MIDI output connection failed', error))
            }
        }
        sharedWebMidi.addEventListener(EVENT_READY, followSharedAccess, { signal: this.abort.signal })
        followSharedAccess()
    }
    get name(): string { return this.options.deviceName ?? WEBMIDI_OUTPUT_ID }
    get description(): string { return 'Sends MIDI messages to the selected device and channel' }
    get isConnected(): boolean { return this.connected }
    get isHidden(): boolean { return false }
    get outputDevices(): Output[] { return this.connected ? sharedWebMidi.outputs : [] }
    get output(): Output | undefined { return this.outputDevices.find(device => device.id === this.routing.targets()[0]?.id) }
    get sendToAllDevices(): boolean { return this.options.sendToAllDevices === true || this.options.selectedDevice === '' }

    private rememberDefault(): void {
        if (this.options.selectedDevice == null && !this.options.sendToAllDevices && sharedWebMidi.outputs[0]) this.options.selectedDevice = sharedWebMidi.outputs[0].id
    }
    async connect(): Promise<void> {
        if (this.connected || this.destroyed) return
        if (this.connecting) return this.connecting
        this.connecting = (async () => {
            const release = await sharedWebMidi.acquire()
            if (this.destroyed) { release(); return }
            this.releaseAccess = release
            this.connected = true
            this.rememberDefault()
            sharedWebMidi.addEventListener(EVENT_DEVICE_LIST_CHANGED, this.deviceChanged)
            this.routing.refresh()
            this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
        })()
        try { await this.connecting } finally { this.connecting = undefined }
    }
    async disconnect(): Promise<void> {
        this.options.autoConnect = false
        if (this.connecting) await this.connecting.catch(() => {})
        await this.routing.release()
        const wasConnected = this.connected
        this.connected = false
        sharedWebMidi.removeEventListener(EVENT_DEVICE_LIST_CHANGED, this.deviceChanged)
        this.releaseAccess?.(); this.releaseAccess = undefined
        this.routing.refresh()
        if (wasConnected) this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
    }
    setOutput(id: string): void { this.routing.setOutput(id) }
    setSendToAllDevices(all: boolean): void { this.setOutput(all ? '' : this.outputDevices[0]?.id ?? 'unavailable') }
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
    async destroy(): Promise<void> {
        this.destroyed = true
        this.abort.abort()
        await this.disconnect()
        await this.destroyGui()
    }
}
