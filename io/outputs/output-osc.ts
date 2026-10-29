import type { IAudioCommand } from '../../audio-command-interface'
import type { IAudioOutput } from './output-interface'
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from '../../commands'
import { EVENT_CONNECTION_CHANGED } from '../../event-constants'
import { changed, devicePanel } from '../device-controls'
import { commandToOSC, encodeOSC, oscPrefix } from '../osc'
import { OscConnection, oscControls } from '../osc-connection'
import { musicalCommand } from '../event-clip'

export default class OutputOSC extends EventTarget implements IAudioOutput {
    readonly uuid = `Output-OSC-${crypto.randomUUID()}`
    readonly name = 'OSC Bridge'
    readonly description = 'Send musical events to a binary OSC WebSocket bridge'
    readonly isHidden = false
    readonly requiresConnectionControl = true
    readonly options: Record<string, any>
    private connection: OscConnection
    private held = new Map<string, IAudioCommand>()
    private channels = new Set<number>()
    private gui?: HTMLElement
    private status?: HTMLElement
    get isConnected() { return this.connection.isConnected }
    hasOscOutput() { return true }
    constructor(options: Record<string, any> = {}) {
        super(); this.options = { ...options, url: options.url ?? 'ws://127.0.0.1:8080', prefix: oscPrefix(options.prefix ?? '/harmoneasy') }
        this.connection = new OscConnection(() => {}, () => {
            this.held.clear(); this.channels.clear(); if (this.status) this.status.textContent = 'Disconnected'
            this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
        }, message => { if (this.status) this.status.textContent = message })
    }
    getNoteKey(command: IAudioCommand): string { return `${command.channel}:${command.number}` }
    sendCommand(command: IAudioCommand): void {
        if (!this.isConnected) return
        const message = commandToOSC(command, this.options.prefix); if (!message) return
        if (command.type === NOTE_ON && command.velocity > 0) this.held.set(this.getNoteKey(command), { ...command })
        else if (command.type === NOTE_OFF || command.type === NOTE_ON) this.held.delete(this.getNoteKey(command))
        if (command.type === CONTROL_CHANGE) this.channels.add(command.channel)
        this.connection.send(encodeOSC(message))
    }
    noteOn(number: number, velocity: number): void { this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 })) }
    noteOff(number: number): void { this.sendCommand(musicalCommand({ type: NOTE_OFF, number, velocity: 0, channel: 1 })) }
    allNotesOff(): void {
        for (const note of this.held.values()) this.sendCommand({ ...note, type: NOTE_OFF, velocity: 0 })
        for (const channel of this.channels) this.sendCommand(musicalCommand({ type: CONTROL_CHANGE, channel, number: 64, value: 0 }))
        this.held.clear(); this.channels.clear()
    }
    async connect(): Promise<void> {
        await this.connection.connect(this.options.url)
        if (this.isConnected) { if (this.status) this.status.textContent = 'Connected'; changed(this); this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED)) }
    }
    async disconnect(): Promise<void> { this.allNotesOff(); this.connection.disconnect() }
    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        const panel = devicePanel(); this.status = document.createElement('p'); this.status.setAttribute('role', 'status')
        this.status.textContent = this.isConnected ? 'Connected' : 'Connect to your OSC bridge.'
        oscControls(panel, this.options, () => { void this.disconnect(); changed(this) }, this.status)
        return this.gui = panel
    }
    async destroyGui(): Promise<void> { this.gui?.remove(); this.gui = undefined; this.status = undefined }
    destroy(): void { void this.disconnect(); void this.destroyGui() }
}
