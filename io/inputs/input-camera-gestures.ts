import NoteInput from './note-input'
import { bounded, changed, devicePanel, numberControl } from '../device-controls'
import { EVENT_ENDED, EVENT_ERROR, EVENT_MESSAGE, EVENT_VISIBILITY_CHANGE } from '../../event-constants'

interface Landmark { x: number; y: number }

export default class InputCameraGestures extends NoteInput {
    readonly requiresConnectionControl = true
    private worker?: Worker
    private stream?: MediaStream
    private video?: HTMLVideoElement
    private gui?: HTMLElement
    private status?: HTMLElement
    private frame = 0
    private busy = false
    private generation = 0
    private currentNote?: number
    private lastResult = 0
    private rejectLoad?: (error: Error) => void
    private connecting?: Promise<void>
    private visibility = () => { if (document.hidden) this.releaseGesture() }
    get name() { return 'Camera Gestures' }
    get description() { return 'Pinch to play; move your hand sideways to select pitch' }
    constructor(options: Record<string, any> = {}) {
        super(options)
        this.options.root = Math.round(bounded(options.root, 60, 0, 103))
        this.options.channel = Math.round(bounded(options.channel, 1, 1, 16))
        this.options.pinch = bounded(options.pinch, 0.3, 0.05, 0.8)
    }

    processLandmarks(points: Landmark[]): void {
        if (!this.isConnected) return
        const valid = points.length >= 21 && points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
        if (!valid || document.hidden) { this.releaseGesture(); return }
        const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y)
        const scale = distance(points[0], points[9])
        const pinch = distance(points[4], points[8]) / Math.max(0.001, scale)
        // Separate engage/release thresholds suppress noisy pinches.
        if (pinch > this.options.pinch * (this.currentNote === undefined ? 1 : 1.3)) { this.releaseGesture(); return }
        const note = this.options.root + Math.round(Math.max(0, Math.min(1, 1 - points[8].x)) * 24)
        if (note !== this.currentNote) {
            this.releaseGesture(); this.currentNote = note
            this.noteOn(note, Math.max(20, Math.round((1 - Math.max(0, Math.min(1, points[8].y))) * 127)), this.options.channel)
        }
    }
    private releaseGesture(): void { this.allNotesOff(); this.currentNote = undefined }

    connect(): Promise<void> {
        if (this.isConnected) return Promise.resolve()
        return this.connecting ??= this.open().finally(() => { this.connecting = undefined })
    }
    private async open(): Promise<void> {
        const generation = ++this.generation
        if (this.status) this.status.textContent = 'Loading hand tracking model…'
        try {
            const worker = this.worker = new Worker(new URL('./camera-gestures.worker.ts', import.meta.url), { type: 'module' })
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Hand tracking model loading timed out')), 30000)
                const fail = (error: Error) => { clearTimeout(timeout); reject(error) }
                this.rejectLoad = fail
                worker.addEventListener(EVENT_ERROR, () => {
                    fail(new Error('Hand tracking worker failed'))
                    if (this.status) this.status.textContent = 'Hand tracking worker failed. Reconnect to retry.'
                    void this.disconnect()
                })
                worker.addEventListener(EVENT_MESSAGE, (event: MessageEvent) => {
                    if (generation !== this.generation) return
                    if (event.data.type === 'ready') { clearTimeout(timeout); this.rejectLoad = undefined; resolve() }
                    else if (event.data.type === 'landmarks') {
                        this.busy = false; this.lastResult = performance.now(); this.processLandmarks(event.data.landmarks)
                    } else if (event.data.type === 'error') {
                        const error = new Error(event.data.message); fail(error)
                        if (this.status) this.status.textContent = error.message
                        void this.disconnect()
                    }
                })
                worker.postMessage({ type: 'init' })
            })
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
            if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return }
            this.stream = stream
            const video = this.video = document.createElement('video')
            video.muted = true; video.playsInline = true; video.srcObject = stream
            video.style.cssText = 'width:100%;max-height:180px;transform:scaleX(-1)'
            this.gui?.append(video)
            await video.play()
            if (generation !== this.generation) return
            this.setAsConnected(); this.busy = false; this.lastResult = performance.now()
            if (this.status) this.status.textContent = 'Pinch thumb and index finger to play; move sideways for pitch and vertically for velocity.'
            document.addEventListener(EVENT_VISIBILITY_CHANGE, this.visibility)
            stream.getTracks().forEach(track => track.addEventListener(EVENT_ENDED, () => { if (generation === this.generation) void this.disconnect() }, { once: true }))
            const analyse = async () => {
                if (generation !== this.generation || !this.isConnected) return
                if (performance.now() - this.lastResult > 400) this.releaseGesture()
                if (!this.busy && !document.hidden && video.readyState >= 2) {
                    this.busy = true
                    try {
                        const bitmap = await createImageBitmap(video)
                        if (generation !== this.generation) { bitmap.close(); return }
                        worker.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap])
                    } catch { this.busy = false; this.releaseGesture() }
                }
                this.frame = requestAnimationFrame(() => { void analyse() })
            }
            void analyse()
        } catch (error) {
            if (generation === this.generation) {
                await this.disconnect()
                if (this.status) this.status.textContent = error instanceof Error ? error.message : String(error)
            }
            throw error
        }
    }
    async disconnect(): Promise<void> {
        ++this.generation; this.rejectLoad?.(new Error('Camera disconnected')); this.rejectLoad = undefined
        cancelAnimationFrame(this.frame); this.worker?.terminate(); this.worker = undefined
        this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined
        if (this.video) { this.video.pause(); this.video.srcObject = null; this.video.remove(); this.video = undefined }
        document.removeEventListener(EVENT_VISIBILITY_CHANGE, this.visibility)
        this.releaseGesture(); await super.disconnect()
    }
    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        const panel = devicePanel(); this.status = document.createElement('p')
        this.status.setAttribute('role', 'status'); this.status.textContent = 'Connect to load the tracking model and enable your camera.'; panel.append(this.status)
        numberControl(panel, 'Lowest note', this.options.root, 0, 103, value => { this.releaseGesture(); this.options.root = value; changed(this) })
        numberControl(panel, 'Channel', this.options.channel, 1, 16, value => { this.releaseGesture(); this.options.channel = value; changed(this) })
        numberControl(panel, 'Pinch threshold', this.options.pinch, 0.05, 0.8, value => { this.options.pinch = value; changed(this) }, 0.05)
        if (this.video) panel.append(this.video)
        return this.gui = panel
    }
    async destroyGui(): Promise<void> { this.releaseGesture(); this.gui?.remove(); this.gui = undefined; this.status = undefined }
    destroy(): void { void this.disconnect(); void this.destroyGui() }
}
