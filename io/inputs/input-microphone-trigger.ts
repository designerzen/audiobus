import NoteInput from './note-input'
import { action, bounded, changed, devicePanel, numberControl } from '../device-controls'
import { EVENT_ENDED, EVENT_VISIBILITY_CHANGE } from '../../event-constants'

export default class InputMicrophoneTrigger extends NoteInput {
    readonly requiresConnectionControl = true
    private stream?: MediaStream
    private source?: MediaStreamAudioSourceNode
    private analyser?: AnalyserNode
    private frame = 0
    private generation = 0
    private armed = true
    private lastTrigger = -Infinity
    private gui?: HTMLElement
    private status?: HTMLElement
    private level = 0
    private lastStatus = -Infinity
    private connecting?: Promise<void>
    private visibility = () => { if (document.hidden) this.allNotesOff() }
    get name() { return 'Microphone Triggers' }
    get description() { return 'Claps and taps become drum notes using an adjustable amplitude threshold' }
    constructor(options: Record<string, any> = {}) {
        super(options)
        this.options.threshold = bounded(options.threshold, 0.12, 0.005, 1)
        this.options.retriggerMs = bounded(options.retriggerMs, 150, 30, 2000)
        this.options.note = Math.round(bounded(options.note, 36, 0, 127))
        this.options.channel = Math.round(bounded(options.channel, 10, 1, 16))
    }
    /** Hysteresis prevents a sustained loud signal from retriggering indefinitely. */
    processLevel(level: number, nowMs: number): void {
        if (!this.isConnected || !Number.isFinite(level) || document.hidden) return
        this.level = level
        if (this.status && nowMs - this.lastStatus > 200) {
            this.status.textContent = `Input level ${level.toFixed(3)}; threshold ${this.options.threshold.toFixed(3)}`
            this.lastStatus = nowMs
        }
        if (level < this.options.threshold * 0.6) this.armed = true
        if (this.armed && level >= this.options.threshold && nowMs - this.lastTrigger >= this.options.retriggerMs) {
            this.armed = false; this.lastTrigger = nowMs
            this.pulse(this.options.note, Math.max(1, Math.min(127, Math.round(level * 127))), 80, this.options.channel)
        }
    }
    connect(): Promise<void> {
        if (this.isConnected) return Promise.resolve()
        return this.connecting ??= this.open().catch(error => {
            if (this.status) this.status.textContent = error instanceof Error ? error.message : String(error)
            throw error
        }).finally(() => { this.connecting = undefined })
    }
    private async open(): Promise<void> {
        const context: AudioContext = this.options.audioContext
        if (!context) throw new Error('Microphone Triggers requires an audio context')
        const generation = ++this.generation
        await context.resume()
        if (generation !== this.generation) return
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return }
        try {
            this.stream = stream; this.source = context.createMediaStreamSource(stream)
            this.analyser = context.createAnalyser(); this.analyser.fftSize = 1024
            this.source.connect(this.analyser)
            this.armed = true; this.lastTrigger = -Infinity; this.setAsConnected()
            document.addEventListener(EVENT_VISIBILITY_CHANGE, this.visibility)
            stream.getTracks().forEach(track => track.addEventListener(EVENT_ENDED, () => { if (generation === this.generation) void this.disconnect() }, { once: true }))
            const data = new Float32Array(this.analyser.fftSize)
            const analyse = () => {
                if (!this.isConnected || generation !== this.generation) return
                this.analyser!.getFloatTimeDomainData(data)
                this.processLevel(Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length), performance.now())
                this.frame = requestAnimationFrame(analyse)
            }
            analyse()
        } catch (error) { await this.disconnect(); throw error }
    }
    async disconnect(): Promise<void> {
        ++this.generation; cancelAnimationFrame(this.frame)
        this.source?.disconnect(); this.analyser?.disconnect()
        this.stream?.getTracks().forEach(track => track.stop())
        this.source = undefined; this.analyser = undefined; this.stream = undefined
        document.removeEventListener(EVENT_VISIBILITY_CHANGE, this.visibility)
        await super.disconnect()
    }
    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        const panel = devicePanel(), help = document.createElement('p')
        help.textContent = 'Connect to enable the microphone. Set the threshold above room noise; claps and taps trigger notes.'; panel.append(help)
        this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); panel.append(this.status)
        const threshold = numberControl(panel, 'Threshold', this.options.threshold, 0.005, 1, value => { this.options.threshold = value; changed(this) }, 0.005)
        action(panel, 'Set threshold above current noise', () => {
            if (!this.isConnected) throw new Error('Connect the microphone first')
            this.options.threshold = bounded(this.level * 2 + 0.01, 0.12, 0.005, 1)
            threshold.value = String(this.options.threshold); changed(this)
        }, this.status)
        numberControl(panel, 'Retrigger interval (ms)', this.options.retriggerMs, 30, 2000, value => { this.options.retriggerMs = value; changed(this) })
        numberControl(panel, 'Note', this.options.note, 0, 127, value => { this.allNotesOff(); this.options.note = value; changed(this) })
        numberControl(panel, 'Channel', this.options.channel, 1, 16, value => { this.allNotesOff(); this.options.channel = value; changed(this) })
        return this.gui = panel
    }
    async destroyGui(): Promise<void> { this.gui?.remove(); this.gui = undefined; this.status = undefined }
    destroy(): void { void this.disconnect(); void this.destroyGui() }
}
