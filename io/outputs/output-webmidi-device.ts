import { WebMidi, type Output } from 'webmidi'
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
    private connected = false
    private routing: MidiOutputRouting
    private deviceChanged = () => {
        this.rememberDefault()
        this.routing.refresh()
        this.dispatchEvent(new Event('deviceListChanged'))
    }

    constructor(options: Record<string, any> = {}) {
        super()
        this.options = { ...options }
        if (options.midiOutput?.id && this.options.selectedDevice == null) this.options.selectedDevice = options.midiOutput.id
        this.routing = new MidiOutputRouting(this.options,
            () => this.outputDevices.map(device => ({ id: device.id, name: [device.manufacturer, device.name].filter(Boolean).join(' ') || device.id })),
            (id, bytes) => {
                if (this.connected) WebMidi.outputs.find(device => device.id === id)?.send(bytes)
            }, () => this.dispatchEvent(new Event('configurationChanged')))
    }
    get name(): string { return WEBMIDI_OUTPUT_ID }
    get description(): string { return 'Sends MIDI messages to the selected device and channel' }
    get isConnected(): boolean { return this.connected }
    get isHidden(): boolean { return false }
    get outputDevices(): Output[] { return this.connected ? [...WebMidi.outputs] : [] }
    get output(): Output | undefined { return this.outputDevices.find(device => device.id === this.routing.targets()[0]?.id) }
    get sendToAllDevices(): boolean { return this.options.sendToAllDevices === true || this.options.selectedDevice === '' }

    private rememberDefault(): void {
        if (this.options.selectedDevice == null && !this.options.sendToAllDevices && WebMidi.outputs[0]) this.options.selectedDevice = WebMidi.outputs[0].id
    }
    async connect(): Promise<void> {
        if (this.connected) return
        await WebMidi.enable({ sysex: true })
        this.connected = true
        this.rememberDefault()
        WebMidi.addListener('connected', this.deviceChanged)
        WebMidi.addListener('disconnected', this.deviceChanged)
        this.routing.refresh()
    }
    async disconnect(): Promise<void> {
        await this.routing.release()
        this.connected = false
        WebMidi.removeListener('connected', this.deviceChanged)
        WebMidi.removeListener('disconnected', this.deviceChanged)
        this.routing.refresh()
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
    async destroy(): Promise<void> { await this.disconnect(); await this.destroyGui() }
}
