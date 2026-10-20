import { WebMidi, type Input, type Output } from 'webmidi'
import { EVENT_CONNECTED, EVENT_DISCONNECTED, EVENT_MIDIMESSAGE, EVENT_DEVICE_LIST_CHANGED, EVENT_MIDI_CHANNELS_CHANGED, EVENT_READY } from '../event-constants'

export interface WebMidiDeviceChange {
    inputs: Input[]
    outputs: Output[]
    device?: Input | Output
    disconnected: boolean
    activeInputs: Set<object>
}

// Own WebMIDI access and one raw listener per physical port. Inputs, profiles,
// clock inputs and outputs subscribe here without owning or closing the ports.
export class SharedWebMidi extends EventTarget {
    #owners = new Set<object>()
    #inputs = new Map<string, { port: Input; remove: () => void }>()
    #outputs: Output[] = []
    #channels = new Map<string, Set<number>>()
    #consumers = new Map<object, { matches: (id: string) => boolean; active: () => boolean }>()
    #starting?: Promise<void>
    #running = false
    get isReady(): boolean { return this.#running }
    get inputs(): Input[] { return [...this.#inputs.values()].map(item => item.port) }
    get outputs(): Output[] { return [...this.#outputs] }
    observedChannels(id: string): number[] { return [...this.#channels.get(id) ?? []].sort((a, b) => a - b) }
    registerInput(owner: object, matches: (id: string) => boolean, active: () => boolean) {
        this.#consumers.set(owner, { matches, active })
        return () => { this.#consumers.delete(owner) }
    }
    async acquire(): Promise<() => void> {
        const owner = {}
        this.#owners.add(owner)
        try {
            if (!this.#running) {
                this.#starting ??= (async () => {
                    if (!WebMidi.enabled) await WebMidi.enable({ sysex: true })
                    WebMidi.addListener(EVENT_CONNECTED, this.#deviceChanged)
                    WebMidi.addListener(EVENT_DISCONNECTED, this.#deviceChanged)
                    this.#running = true
                    this.#sync()
                    this.dispatchEvent(new Event(EVENT_READY))
                })().finally(() => { this.#starting = undefined })
                await this.#starting
            }
        } catch (error) { this.#owners.delete(owner); throw error }
        return () => {
            if (!this.#owners.delete(owner)) return
            if (this.#owners.size) return
            WebMidi.removeListener(EVENT_CONNECTED, this.#deviceChanged)
            WebMidi.removeListener(EVENT_DISCONNECTED, this.#deviceChanged)
            for (const item of this.#inputs.values()) item.remove()
            this.#inputs.clear(); this.#outputs = []; this.#channels.clear()
            this.#running = false
        }
    }
    #deviceChanged = (event: any) => this.#sync(event)
    #sync(event?: any) {
        const port = event?.port as Input | Output | undefined
        const disconnected = event?.type === EVENT_DISCONNECTED
        const activeInputs = new Set<object>()
        if (disconnected && port?.type === 'input' && this.#inputs.has(port.id)) {
            for (const [owner, consumer] of this.#consumers) if (consumer.active() && consumer.matches(port.id)) activeInputs.add(owner)
        }
        const available = new Map((WebMidi.inputs ?? []).filter(input => input.state !== 'disconnected').map(input => [input.id, input]))
        if (port?.type === 'input') {
            if (disconnected) available.delete(port.id)
            else available.set(port.id, port as Input)
        }
        let changed = false
        for (const [id, item] of this.#inputs) if (available.get(id) !== item.port) {
            item.remove(); this.#inputs.delete(id); this.#channels.delete(id); changed = true
        }
        for (const [id, input] of available) if (!this.#inputs.has(id)) {
            const receive = (message: any) => {
                const data = message.message?.data ?? message.data
                const status = data?.[0]
                if (status >= 0x80 && status < 0xf0) {
                    const channels = this.#channels.get(id) ?? new Set<number>()
                    const channel = (status & 15) + 1
                    if (!channels.has(channel)) {
                        channels.add(channel); this.#channels.set(id, channels)
                        this.dispatchEvent(new CustomEvent(EVENT_MIDI_CHANNELS_CHANGED, { detail: { deviceId: id, channels: this.observedChannels(id) } }))
                    }
                }
                this.dispatchEvent(new CustomEvent(EVENT_MIDIMESSAGE, { detail: { device: input, event: message } }))
            }
            input.addListener(EVENT_MIDIMESSAGE, receive)
            this.#inputs.set(id, { port: input, remove: () => { input.removeListener(EVENT_MIDIMESSAGE, receive) } })
            changed = true
        }
        const outputs = (WebMidi.outputs ?? []).filter(output => output.state !== 'disconnected' && !(disconnected && port?.type === 'output' && output.id === port.id))
        if (port?.type === 'output' && !disconnected && !outputs.some(output => output.id === port.id)) outputs.push(port as Output)
        if (outputs.length !== this.#outputs.length || outputs.some((output, index) => output !== this.#outputs[index])) changed = true
        this.#outputs = outputs
        if (changed) this.dispatchEvent(new CustomEvent<WebMidiDeviceChange>(EVENT_DEVICE_LIST_CHANGED, {
            detail: { inputs: this.inputs, outputs: this.outputs, device: port, disconnected, activeInputs }
        }))
    }
}

export const sharedWebMidi = new SharedWebMidi()
