import type { IAudioOutput } from './output-interface'
import type { IAudioCommand } from '../../audio-command-interface'
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON } from '../../commands'
import { action, changed, devicePanel, downloadJSON } from '../device-controls'
import { clipCommand, MAX_CLIP_DURATION, MAX_CLIP_EVENTS, musicalCommand, parseEventClip, supportsClipCommand } from '../event-clip'

export default class OutputEventRecorder extends EventTarget implements IAudioOutput {
    readonly uuid = `Output-EventRecorder-${crypto.randomUUID()}`
    readonly name = 'Event Recorder / Looper'
    readonly description = 'Capture this chain’s notes and controllers, then load the saved loop in an Event Loop input'
    readonly isHidden = false
    readonly requiresConnectionControl = false
    readonly configurationAffectsNoteRouting = false
    readonly options: Record<string, any>
    private recording = false
    private started = 0
    private gui?: HTMLElement
    private status?: HTMLElement
    private button?: HTMLButtonElement
    private held = new Map<string, IAudioCommand>()
    private channels = new Set<number>()
    private connected = true
    get isConnected() { return this.connected }
    private get now(): number { return this.options.now?.() ?? performance.now() / 1000 }
    constructor(options: Record<string, any> = {}) {
        super(); this.options = { ...options, commands: [], duration: 1 }
        if (options.commands?.length) Object.assign(this.options, parseEventClip({ version: 1, duration: options.duration, commands: options.commands }))
    }
    getNoteKey(command: IAudioCommand): string { return `${command.channel}:${command.number}` }
    startRecording(): void {
        this.options.commands = []; this.options.duration = 1
        this.started = this.now; this.recording = true; this.held.clear(); this.channels.clear(); this.render()
    }
    stopRecording(): void {
        if (!this.recording) return
        const duration = Math.max(0.01, Math.min(MAX_CLIP_DURATION, this.now - this.started))
        for (const note of this.held.values()) this.options.commands.push(clipCommand({ ...note, type: NOTE_OFF, velocity: 0 }, duration))
        for (const channel of this.channels) this.options.commands.push(musicalCommand({ type: CONTROL_CHANGE, channel, number: 64, value: 0, velocity: 0, startAt: duration }))
        this.held.clear(); this.channels.clear(); this.recording = false; this.options.duration = duration
        changed(this); this.render()
    }
    sendCommand(command: IAudioCommand): void {
        if (!this.connected || !this.recording || !supportsClipCommand(command)) return
        const offset = Math.max(0, this.now - this.started)
        // Reserve space for cleanup notes and sustain releases at the end of a take.
        if (offset >= MAX_CLIP_DURATION || this.options.commands.length >= MAX_CLIP_EVENTS - 2064) { this.stopRecording(); return }
        const copy = clipCommand(command, offset)
        copy.channel = Number.isInteger(command.channel) && command.channel >= 1 && command.channel <= 16 ? command.channel : 1
        const key = this.getNoteKey(copy)
        if (copy.type === NOTE_ON && copy.velocity > 0) this.held.set(key, copy)
        else if (copy.type === NOTE_OFF || copy.type === NOTE_ON) this.held.delete(key)
        if (copy.type === CONTROL_CHANGE && copy.number === 64 && copy.value > 0) this.channels.add(copy.channel)
        this.options.commands.push(copy)
        if (this.status) this.status.textContent = `Recording: ${this.options.commands.length} events`
    }
    noteOn(number: number, velocity: number): void { this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 })) }
    noteOff(number: number): void { this.sendCommand(musicalCommand({ type: NOTE_OFF, number, velocity: 0, channel: 1 })) }
    allNotesOff(): void { this.stopRecording() }
    stopClock(): void { this.stopRecording() }
    // Participate in transport stop notifications even when the take contains no held notes.
    onClockTick(): void {}
    private render(): void {
        if (this.button) this.button.textContent = this.recording ? 'Stop recording' : 'Record new loop'
        if (this.status) this.status.textContent = this.recording ? 'Recording musical events…' : `${this.options.commands.length} events; ${this.options.duration.toFixed(2)} seconds`
    }
    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        const panel = devicePanel(); this.status = document.createElement('p'); this.status.setAttribute('role', 'status')
        panel.append(this.status)
        this.button = action(panel, 'Record new loop', () => { if (this.recording) this.stopRecording(); else this.startRecording() }, this.status)
        action(panel, 'Download event loop', () => {
            this.stopRecording()
            if (!this.options.commands.length) throw new Error('Record some notes first')
            const clip = parseEventClip({ version: 1, duration: this.options.duration, commands: this.options.commands })
            downloadJSON(clip, 'harmoneasy-event-loop.json')
        }, this.status)
        const help = document.createElement('p'); help.textContent = 'Load the downloaded JSON in an Event Loop input to replay it through any chain.'; panel.append(help)
        this.render(); return this.gui = panel
    }
    async destroyGui(): Promise<void> { this.gui?.remove(); this.gui = undefined; this.status = undefined; this.button = undefined }
    async disconnect(): Promise<void> { this.stopRecording(); this.connected = false }
    async connect(): Promise<void> { this.connected = true }
    destroy(): void { void this.disconnect(); void this.destroyGui() }
}
