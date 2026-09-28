import type { IAudioCommand } from '../../audio-command-interface.ts'
import { NOTE_OFF, NOTE_ON } from '../../commands'
import { commandToMidi } from '../../midi/midi-command-conversion.ts'
import { ALL_MIDI_CHANNELS } from '../../midi/midi-channels.ts'
import { createMidiInputControls, type MidiInputDeviceOption } from '../inputs/midi-input-controls.ts'

export class MidiOutputRouting {
    private gui?: ReturnType<typeof createMidiInputControls>
    private notes = new Map<string, { device: string; channel: number; note: number }>()
    private sustained = new Map<string, { device: string; channel: number }>()
    private pending: Promise<void> = Promise.resolve()

    constructor(readonly options: Record<string, any>,
        private devices: () => MidiInputDeviceOption[],
        private send: (device: string, data: number[]) => void | Promise<void>,
        private changed: () => void = () => {}) {}

    channels(incoming = 1): number[] {
        const selected = this.options.selectedChannel ?? this.options.channels ?? -1
        if (selected === -1) return [incoming >= 1 && incoming <= 16 ? incoming : 1]
        if (selected === 0) return ALL_MIDI_CHANNELS
        return (Array.isArray(selected) ? selected : [Number(selected)]).filter(channel => Number.isInteger(channel) && channel >= 1 && channel <= 16)
    }

    targets(): MidiInputDeviceOption[] {
        const devices = this.devices()
        if (this.options.sendToAllDevices === true || this.options.selectedDevice === '') return devices
        const selected = this.options.selectedDevice ?? this.options.devices?.[0]
        return selected == null ? devices.slice(0, 1) : devices.filter(device => device.id === String(selected))
    }

    noteKey(command: IAudioCommand): string {
        return `${this.targets().map(device => device.id).join(',')}:${this.channels(command.channel).join(',')}:${command.number}`
    }

    private enqueue(action: () => void | Promise<void>): Promise<void> {
        const result = this.pending.then(action)
        this.pending = result.catch(error => console.error('MIDI output failed', error))
        return result
    }

    sendCommand(command: IAudioCommand): Promise<void> {
        const bytes = commandToMidi(command)
        if (!bytes) return Promise.resolve()
        const targets = this.targets()
        // System and realtime messages have no channel; send them only once per device.
        const channels = bytes[0] < 0xf0 ? this.channels(command.channel) : [0]
        return this.enqueue(async () => {
            for (const device of targets) for (const channel of channels) {
                const data = channel ? [(bytes[0] & 0xf0) | (channel - 1), ...bytes.slice(1)] : [...bytes]
                await this.send(device.id, data)
                const key = `${device.id}:${channel}:${data[1]}`
                if ((data[0] >> 4) === 9 && data[2] > 0) this.notes.set(key, { device: device.id, channel, note: data[1] })
                else if ((data[0] >> 4) === 8 || ((data[0] >> 4) === 9 && data[2] === 0)) this.notes.delete(key)
                if ((data[0] >> 4) === 11 && data[1] === 64) {
                    const pedal = `${device.id}:${channel}`
                    if (data[2] >= 64) this.sustained.set(pedal, { device: device.id, channel })
                    else this.sustained.delete(pedal)
                }
            }
        })
    }

    release(): Promise<void> {
        return this.enqueue(async () => {
            for (const active of this.notes.values()) await this.send(active.device, [0x80 | (active.channel - 1), active.note, 0])
            for (const active of this.sustained.values()) await this.send(active.device, [0xb0 | (active.channel - 1), 64, 0])
            this.notes.clear()
            this.sustained.clear()
        })
    }

    getActiveNotes(): Set<number> { return new Set([...this.notes.values()].map(note => note.note)) }
    clearActiveNotes(): void { this.notes.clear() }

    async createGui(): Promise<HTMLElement> {
        if (!this.gui) {
            // Resolve the initial default once; don't silently route to another device on unplug.
            if (this.options.selectedDevice == null && this.targets()[0]) this.options.selectedDevice = this.targets()[0].id
            this.gui = createMidiInputControls(this.options, this.devices, () => {
                void this.release().catch(() => {})
                this.changed()
            }, 'output')
        }
        return this.gui.element
    }
    refresh(): void { this.gui?.refresh() }
    async destroyGui(): Promise<void> { this.gui?.destroy(); this.gui = undefined }
    setOutput(id: string): void {
        void this.release().catch(() => {})
        this.options.selectedDevice = id
        this.options.sendToAllDevices = id === ''
        this.options.devices = id === '' ? [] : [id]
        this.refresh()
        this.changed()
    }
    setChannel(channel: number | number[]): void {
        const values = Array.isArray(channel) ? channel : [channel]
        if (!values.length || values.some(value => !Number.isInteger(value) || value < -1 || value > 16)) throw new Error('Invalid MIDI channel')
        void this.release().catch(() => {})
        this.options.channels = channel
        this.options.selectedChannel = channel
        this.refresh()
        this.changed()
    }
    noteOn(number: number, velocity = 127, channel = 1): Promise<void> {
        return this.sendCommand({ type: NOTE_ON, number, velocity, channel } as IAudioCommand)
    }
    noteOff(number: number, channel = 1): Promise<void> {
        return this.sendCommand({ type: NOTE_OFF, number, velocity: 0, channel } as IAudioCommand)
    }
}
