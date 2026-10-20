import { EVENT_CONFIGURATION_CHANGED, EVENT_UMP, EVENT_PERNOTECONTROLLER, EVENT_NOTEON, EVENT_NOTEOFF, EVENT_CONTROLCHANGE, EVENT_PITCHBEND, EVENT_PROGRAMCHANGE, EVENT_POLYAFTERTOUCH, EVENT_CHANNELAFTERTOUCH } from '../../event-constants.ts'
import AbstractInput from './abstract-input.ts'
import type { IAudioInput } from './input-interface.ts'
import { acceptsMidiInput, createMidiInputControls } from './midi-input-controls.ts'
import { ALL_MIDI_CHANNELS } from '../../midi/midi-channels.ts'
import { getNativeMidiBridge, type NativeMidiBridge, type NativeMidiDevice } from '../../midi/native-midi-bridge.ts'
import { umpToMidiBytes, umpToCommand } from '../../midi/ump-codec.ts'
import { isMidiProfilePortClaimed } from '../../midi/hardware/device-profiles'

export const MIDI2_NATIVE_INPUT_ID = 'MIDI 2.0 Native'
export default class InputMIDI2Native extends AbstractInput implements IAudioInput {
    #bridge?: NativeMidiBridge
    #devices: NativeMidiDevice[] = []
    #active = new Set<number>()
    #unsubscribe?: () => void
    #gui?: ReturnType<typeof createMidiInputControls>
    #connecting?: Promise<void>
    #disconnecting?: Promise<void>
    #notes = new Map<string, { device: number; group: number; channel: number; note: number; velocity: number; controllers: Map<number, number>; timestamp: number }>()
    #perNote = false
    #sustained = new Map<string, { device: number; group: number; channel: number }>()
    get name() { return MIDI2_NATIVE_INPUT_ID }
    get description() { return 'Native MIDI 2.0 UMP input via Windows MIDI Services or CoreMIDI' }
    get isEnabled() { return this.isConnected }
    get inputDevices() { return [...this.#devices] }
    constructor(options: Record<string, any> = {}) { super({ channels: ALL_MIDI_CHANNELS, devices: [], ...options }) }
    async createGui() {
        this.#gui ??= createMidiInputControls(this.options,
            () => this.#devices.map(device => ({ id: String(device.index), name: device.name })),
            () => { this.#release(); this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED)) })
        return this.#gui.element
    }
    async destroyGui() { this.#gui?.destroy(); this.#gui = undefined }
    async connect(): Promise<Function> {
        if (this.#disconnecting) await this.#disconnecting
        if (this.isConnected) return () => this.disconnect()
        if (this.#connecting) { await this.#connecting; return () => this.disconnect() }
        this.#connecting = (async () => {
            this.#bridge = getNativeMidiBridge()
            try {
                this.#devices = await this.#bridge.getUmpInputs()
                this.#perNote = (await this.#bridge.getCapabilities()).perNoteCC
                this.#gui?.refresh()
                this.#unsubscribe = this.#bridge.onUmpInput((index, words, nativeTimestamp) => this.#receive(index, words, nativeTimestamp))
                for (const device of this.#devices) await this.enableDevice(device.index)
                this.setAsConnected()
            } catch (error) {
                this.#unsubscribe?.(); this.#unsubscribe = undefined
                await this.#closePorts()
                this.setAsDisconnected()
                throw error
            }
        })()
        try { await this.#connecting; return () => this.disconnect() } finally { this.#connecting = undefined }
    }
    async #closePorts() {
        const results = await Promise.allSettled([...this.#active].map(index => this.#bridge!.closeUmpInput(index)))
        this.#active.clear()
        const failure = results.find(result => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason
    }
    async disconnect(): Promise<void> {
        if (this.#disconnecting) return this.#disconnecting
        this.#disconnecting = (async () => {
            if (this.#connecting) await this.#connecting
            this.setAsDisconnected()
            this.#unsubscribe?.(); this.#unsubscribe = undefined
            this.#release()
            await this.#closePorts()
        })()
        try { await this.#disconnecting } finally { this.#disconnecting = undefined }
    }
    #release(device?: number) {
        for (const [key, note] of this.#notes) {
            if (device !== undefined && note.device !== device) continue
            const command = umpToCommand([0x40800000 | (note.group << 24) | ((note.channel - 1) << 16) | (note.note << 8), 0], this.now, String(note.device))
            if (command) this.dispatch(command)
            this.#notes.delete(key)
        }
        for (const [key, pedal] of this.#sustained) {
            if (device !== undefined && pedal.device !== device) continue
            const command = umpToCommand([0x40b04000 | (pedal.group << 24) | ((pedal.channel - 1) << 16), 0], this.now, String(pedal.device))
            if (command) this.dispatch(command)
            this.#sustained.delete(key)
        }
    }
    #receive(device: number, words: number[], nativeTimestamp?: number) {
        if (!this.isConnected || !this.#active.has(device)) return
        if (!this.options.profileId && isMidiProfilePortClaimed('midi2-native', String(device))) {
            this.#release(device)
            return
        }
        const bytes = umpToMidiBytes(words)
        const type = words[0] >>> 28
        const channel = type === 2 || type === 4 ? ((words[0] >>> 16) & 15) + 1 : 0
        const group = (words[0] >>> 24) & 15
        if (!acceptsMidiInput(this.options, String(device), channel)) return
        const timestamp = this.now
        const command = umpToCommand(words, timestamp, String(device))
        if (!command) return
        this.dispatch(command)
        this.dispatchEvent(new CustomEvent(EVENT_UMP, { detail: { words: [...words], channel, group, deviceIndex: device, timestamp, nativeTimestamp } }))
        const key = `${device}:${group}:${channel}:${(words[0] >>> 8) & 127}`
        const midi2 = words[0] >>> 28 === 4
        if (midi2 && words.length === 2 && ((words[0] >>> 20) & 15) <= 1) {
            const controllerType = words[0] & 127
            this.#notes.get(key)?.controllers.set(controllerType, words[1])
            this.dispatchEvent(new CustomEvent(EVENT_PERNOTECONTROLLER, { detail: { note: (words[0] >>> 8) & 127, controllerType, value: words[1], channel, group, deviceIndex: device, timestamp } }))
            return
        }
        if (!bytes) return
        const kind = bytes[0] >> 4
        if (kind === 11 && bytes[1] === 64) {
            const pedalKey = `${device}:${group}:${channel}`
            if (bytes[2] >= 64) this.#sustained.set(pedalKey, { device, group, channel })
            else this.#sustained.delete(pedalKey)
        }
        const detail: Record<string, any> = { channel, group, deviceIndex: device, timestamp }
        let event: string | undefined
        if (kind === 8 || kind === 9) {
            const on = kind === 9 && (midi2 || bytes[2] > 0)
            Object.assign(detail, { note: bytes[1], velocity: midi2 ? words[1] >>> 16 : bytes[2], velocityMidi1: bytes[2] })
            event = on ? EVENT_NOTEON : EVENT_NOTEOFF
            if (on) this.#notes.set(key, { device, group, channel, note: bytes[1], velocity: detail.velocity, controllers: new Map(), timestamp })
            else this.#notes.delete(key)
        } else if (kind === 11) { event = EVENT_CONTROLCHANGE; Object.assign(detail, { controller: bytes[1], value: midi2 ? words[1] : bytes[2], valueMidi1: bytes[2] }) }
        else if (kind === 14) { event = EVENT_PITCHBEND; Object.assign(detail, { value: midi2 ? words[1] : bytes[1] | (bytes[2] << 7), valueMidi1: bytes[1] | (bytes[2] << 7) }) }
        else if (kind === 12) { event = EVENT_PROGRAMCHANGE; detail.program = bytes[1] }
        else if (kind === 10 || kind === 13) { event = kind === 10 ? EVENT_POLYAFTERTOUCH : EVENT_CHANNELAFTERTOUCH; Object.assign(detail, { note: kind === 10 ? bytes[1] : undefined, pressure: midi2 ? words[1] : bytes[kind === 10 ? 2 : 1] }) }
        if (event) this.dispatchEvent(new CustomEvent(event, { detail }))
    }
    getAvailableDevices() { return [...this.#devices] }
    getActiveNotesWithControllers() { return new Map(this.#notes) }
    async enableDevice(index: number) {
        if (!this.#bridge || !this.#devices.some(device => device.index === index)) throw new Error('Invalid MIDI input device')
        if (!this.#active.has(index)) { await this.#bridge.openUmpInput(index); this.#active.add(index) }
    }
    async disableDevice(index: number) {
        if (!this.#active.delete(index)) return
        this.#release(index)
        await this.#bridge!.closeUmpInput(index)
    }
    hasMidiInput() { return true }
    hasSysexInput() { return this.#perNote }
    hasMpeInput() { return this.#perNote }
    async destroy() { try { await this.disconnect() } finally { await this.destroyGui() } }
}
