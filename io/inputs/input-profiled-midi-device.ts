import AbstractInput from './abstract-input'
import type InputAudioEvent from '../events/input-audio-event'
import { INPUT_EVENT, EVENT_CONFIGURATION_CHANGED, EVENT_CONNECTION_CHANGED, EVENT_DEVICE_LIST_CHANGED } from '../../event-constants'
import { MIDI_DEVICE_PROFILES, claimMidiProfilePort, matchMidiDeviceProfile, type MidiProfileTransport } from '../../midi/device-profiles'
import { getNativeMidiBridge } from '../../midi/native-midi-bridge'
import { midiToCommand } from '../../midi/midi-command-conversion'
import { createProfiledMidiGui } from './profiled-midi-gui'
import { profileMessageBytes } from '../../midi/device-profile-schema'
import { sharedWebMidi } from '../../midi/shared-webmidi'

export default class InputProfiledMidiDevice extends AbstractInput {
    #adapter?: AbstractInput
    #gui?: ReturnType<typeof createProfiledMidiGui>
    #unclaim?: () => void
    #pending: Promise<void> = Promise.resolve()
    get profile() {
        const profile = MIDI_DEVICE_PROFILES[this.options.profileId]
        if (!profile) throw new Error(`Unknown MIDI device profile: ${this.options.profileId}`)
        return profile
    }
    get name() { return MIDI_DEVICE_PROFILES[this.options?.profileId]?.name ?? 'MIDI instrument' }
    get description() { return this.profile.description }
    get isEnabled() { return this.isConnected }
    get inputDevices() { return (this.#adapter as any)?.inputDevices ?? [] }
    get midiInput() { return this.#adapter }
    constructor(options: Record<string, any> = {}) { super({ selectedChannel: 0, ...options }); void this.profile }
    hasMidiInput() { return true }

    #forward = (event: Event) => {
        const input = event as unknown as InputAudioEvent
        // Learned CC bindings belong to the persistent endpoint, not a native
        // enumeration index that can change when another device is unplugged.
        input.command.from = this.options.deviceId
        this.#gui?.receive(input.command)
        this.dispatch(input.command, input.origin)
    }
    #connectionChanged = () => {
        if (this.#adapter?.isConnected) this.setAsConnected()
        else { this.#gui?.release(); this.setAsDisconnected() }
        this.#gui?.setConnected(this.isConnected, this.options.deviceId ?? '')
    }
    #devicesChanged = (event: Event) => this.dispatchEvent(new CustomEvent(EVENT_DEVICE_LIST_CHANGED, { detail: (event as CustomEvent).detail }))
    #serial(operation: () => Promise<void>) {
        const next = this.#pending.then(operation)
        this.#pending = next.catch(() => {})
        return next
    }
    async #open(): Promise<void> {
        if (this.isConnected) return
        const transport: MidiProfileTransport = this.options.transport ?? 'webmidi'
        let id = this.options.deviceId as string | undefined
        let selectedDevice: string | undefined
        let releaseDiscovery: (() => void) | undefined
        if (transport === 'webmidi') {
            releaseDiscovery = await sharedWebMidi.acquire()
            const device = sharedWebMidi.inputs.find(port => id ? port.id === id : matchMidiDeviceProfile(port) === this.options.profileId)
            if (device) { id = device.id; selectedDevice = device.id }
        } else {
            const devices = await getNativeMidiBridge().getUmpInputs()
            const device = devices.find(port => id ? (port.id ?? String(port.index)) === id : matchMidiDeviceProfile(port) === this.options.profileId)
            if (device) { id = device.id ?? String(device.index); selectedDevice = String(device.index) }
        }
        if (selectedDevice === undefined || id === undefined) {
            releaseDiscovery?.()
            this.#gui?.setConnected(false, id ?? '')
            return
        }
        this.options.deviceId = id
        this.options.transport = transport
        const adapterOptions = { ...this.options, selectedDevice, devices: [selectedDevice], listenToAllDevices: false }
        const Adapter = transport === 'webmidi'
            ? (await import('./input-webmidi-device')).default
            : (await import('./input-midi2-native-device')).default
        const adapter = new Adapter(adapterOptions)
        this.#adapter = adapter
        adapter.addEventListener(INPUT_EVENT, this.#forward)
        adapter.addEventListener(EVENT_CONNECTION_CHANGED, this.#connectionChanged)
        adapter.addEventListener(EVENT_DEVICE_LIST_CHANGED, this.#devicesChanged)
        this.#unclaim = claimMidiProfilePort(transport, selectedDevice, this)
        try {
            await adapter.connect()
            this.setAsConnected()
            this.#gui?.setConnected(true, id)
        } catch (error) {
            await this.#close()
            throw error
        } finally { releaseDiscovery?.() }
    }
    async #close(): Promise<void> {
        const adapter = this.#adapter
        try {
            this.#gui?.release()
            // Keep forwarding note-offs and sustain release during disconnect.
            await (adapter as any)?.disconnect()
        } finally {
            adapter?.removeEventListener(INPUT_EVENT, this.#forward)
            adapter?.removeEventListener(EVENT_CONNECTION_CHANGED, this.#connectionChanged)
            adapter?.removeEventListener(EVENT_DEVICE_LIST_CHANGED, this.#devicesChanged)
            try { await (adapter as any)?.destroy?.() }
            finally {
                this.#adapter = undefined
                this.#unclaim?.(); this.#unclaim = undefined
                this.setAsDisconnected()
                this.#gui?.setConnected(false, this.options.deviceId ?? '')
            }
        }
    }
    connect(): Promise<() => Promise<void>> { return this.#serial(() => this.#open()).then(() => () => this.disconnect()) }
    disconnect(): Promise<void> { return this.#serial(() => this.#close()) }
    async createGui(): Promise<HTMLElement> {
        this.#gui ??= createProfiledMidiGui(this.profile, this.options, (message, value) => {
            if (!this.isConnected) return
            const command = midiToCommand(profileMessageBytes(message, value, this.options.selectedChannel || 1), this.now, this.options.deviceId)
            if (command) { this.#gui?.receive(command); this.dispatch(command) }
        }, () => {
            if (this.#adapter && this.#adapter.options.selectedChannel !== this.options.selectedChannel) {
                void this.disconnect().then(() => this.connect()).catch(error => console.warn('MIDI channel change failed', error))
            }
            this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
        })
        this.#gui.setConnected(this.isConnected, this.options.deviceId ?? '')
        return this.#gui.element
    }
    async destroyGui() { this.#gui?.destroy(); this.#gui = undefined }
    async destroy() { await this.disconnect(); await this.destroyGui() }
}
