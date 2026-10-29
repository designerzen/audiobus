// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_AUDIO_VIZ_READY, EVENT_BLUR, EVENT_CHANGE, EVENT_CLICK, EVENT_PAGE_HIDE, EVENT_POINTER_CANCEL, EVENT_POINTER_DOWN, EVENT_POINTER_MOVE, EVENT_POINTER_UP, EVENT_VISIBILITY_CHANGE } from "../../../event-constants.ts"
import styles from "./audio-viz.css?inline"
import { instrumentNote, type InstrumentNote } from "../../interfaces/instrument.ts"
import { observeAudioContextOutput } from "../../interfaces/audio-context-output.ts"

type Kind = "horizontal-bars" | "vertical-bars" | "waveform" | "spectrum" | "pointer" | "song"
interface Voice {
    note: InstrumentNote
    velocity: number
    colour?: string
}
interface Segment extends Voice {
    start: number
    end?: number
    key: string
}

/** Silent, bounded canvas rendering with explicit ownership of animation and analyser resources. */
export abstract class CanvasAudioViz extends HTMLElement {
    static observedAttributes = [
        "label",
        "paused",
        "hidden",
        "min",
        "max",
        "fft-size",
        "decorative",
        "overlay",
    ]
    protected abstract readonly kind: Kind
    protected root = this.attachShadow({ mode: "open" })
    readonly canvas: HTMLCanvasElement
    private context: CanvasRenderingContext2D | null
    private voices = new Map<string, Voice>()
    private segments: Segment[] = []
    private analyser?: AnalyserNode
    private sourceContext?: BaseAudioContext
    private selectedContext: BaseAudioContext | null = null
    private unobserveOutput?: () => void
    private signalState = ""
    private source?: AudioNode
    private data = new Uint8Array(512)
    private externalData?: Uint8Array
    private resize?: ResizeObserver
    private intersection?: IntersectionObserver
    private listeners?: AbortController
    private motion = matchMedia("(prefers-reduced-motion: reduce)")
    private forcedColours = matchMedia("(forced-colors: active)")
    private visible = true
    private frame?: number
    private width = 1
    private height = 1
    private pointer = { x: 0, y: 0, visible: false, pressed: false }
    private tint?: string
    private suspended = false
    private blend: GlobalCompositeOperation = "source-over"

    constructor() {
        super()
        this.root.innerHTML = `<style>${styles}</style><canvas part="canvas" role="img"></canvas><div class="controls" part="controls"><button type="button" part="pause">Pause visualisation</button><span id="summary" class="summary" part="summary"></span></div>`
        this.canvas = this.root.querySelector("canvas")!
        this.context = this.canvas.getContext("2d")
    }
    /** The shared engine registers its output; callers only need to supply its context. */
    get audioContext(): BaseAudioContext | null {
        return this.selectedContext ?? this.sourceContext ?? null
    }
    set audioContext(value: BaseAudioContext | null) {
        if (value === this.selectedContext && this.unobserveOutput) return
        this.disconnectSource()
        this.selectedContext = value
        this.observeOutput()
    }
    private observeOutput() {
        if (!this.isConnected || !this.selectedContext || this.unobserveOutput) return
        const context = this.selectedContext
        this.unobserveOutput = observeAudioContextOutput(context, (source) => {
            this.attachSource(context, source)
        })
    }
    get paused() {
        return this.hasAttribute("paused")
    }
    set paused(value: boolean) {
        this.toggleAttribute("paused", value)
    }
    get min() {
        return this.bound("min", 0)
    }
    get max() {
        return Math.max(this.min, this.bound("max", 127))
    }
    get backgroundColour() {
        return getComputedStyle(this.canvas).backgroundColor
    }
    get colour() {
        return this.tint
    }
    set colour(value: string | false | undefined) {
        this.tint = value || undefined
        this.render()
    }
    get blendMode() {
        return this.blend
    }
    set blendMode(value: GlobalCompositeOperation) {
        this.blend = value
        this.render()
    }
    get fftSize() {
        const value = Number(this.getAttribute("fft-size") ?? 512)
        return Number.isInteger(value) &&
            value >= 32 &&
            value <= 32768 &&
            Math.log2(value) % 1 === 0
            ? value
            : 512
    }
    private bound(name: string, fallback: number) {
        const raw = this.getAttribute(name)
        const value = raw === null || !raw.trim() ? fallback : Number(raw)
        return Number.isFinite(value) ? Math.max(0, Math.min(127, Math.round(value))) : fallback
    }
    connectedCallback() {
        this.suspended = false
        this.observeOutput()
        if (this.ownerDocument.documentElement.hasAttribute("data-audio-viz-paused"))
            this.paused = true
        this.listeners?.abort()
        this.listeners = new AbortController()
        const options = { signal: this.listeners.signal }
        this.root.querySelector("button")!.addEventListener(
            EVENT_CLICK,
            () => {
                this.paused = !this.paused
            },
            options,
        )
        this.motion.addEventListener(
            EVENT_CHANGE,
            () => {
                this.syncLoop()
                this.render()
            },
            options,
        )
        this.ownerDocument.addEventListener(EVENT_VISIBILITY_CHANGE, () => this.syncLoop(), options)
        this.forcedColours.addEventListener(EVENT_CHANGE, () => this.render(), options)
        window.addEventListener(
            EVENT_PAGE_HIDE,
            () => {
                this.suspended = true
                this.syncLoop()
            },
            options,
        )
        window.addEventListener(
            "pageshow",
            () => {
                this.suspended = false
                this.syncLoop()
            },
            options,
        )
        if (this.kind === "pointer") {
            const move = (event: PointerEvent) => {
                const rect = this.canvas.getBoundingClientRect()
                this.pointer.x = event.clientX - rect.left
                this.pointer.y = event.clientY - rect.top
                this.pointer.visible =
                    this.pointer.x >= 0 &&
                    this.pointer.y >= 0 &&
                    this.pointer.x <= rect.width &&
                    this.pointer.y <= rect.height
                this.pointer.pressed = event.buttons !== 0
                if (!this.paused) this.render()
            }
            for (const type of [
                EVENT_POINTER_MOVE,
                EVENT_POINTER_DOWN,
                EVENT_POINTER_UP,
                EVENT_POINTER_CANCEL,
            ] as const)
                this.ownerDocument.addEventListener(type, move, { ...options, passive: true })
            window.addEventListener(
                EVENT_BLUR,
                () => {
                    this.pointer.visible = false
                    this.render()
                },
                options,
            )
        }
        this.resize = new ResizeObserver(() => this.measure())
        this.resize.observe(this.canvas)
        this.intersection = new IntersectionObserver((entries) => {
            this.visible = entries[0]?.isIntersecting ?? true
            this.syncLoop()
        })
        this.intersection.observe(this)
        this.measure()
        this.update()
        this.setAttribute("data-audio-viz", "")
        this.dispatchEvent(new Event(EVENT_AUDIO_VIZ_READY, { bubbles: true, composed: true }))
    }
    disconnectedCallback() {
        this.cancelFrame()
        this.resize?.disconnect()
        this.intersection?.disconnect()
        this.listeners?.abort()
        this.listeners = undefined
        this.unobserveOutput?.()
        this.unobserveOutput = undefined
        this.detachSource()
        this.clearActiveNotes()
    }
    attributeChangedCallback() {
        this.update()
    }
    private update() {
        const label = this.getAttribute("label") || `${this.kind ?? "Audio"} visualisation`
        this.canvas.setAttribute("aria-label", label)
        this.canvas.setAttribute("aria-describedby", "summary")
        this.canvas.setAttribute(
            "aria-hidden",
            String(this.hasAttribute("decorative") || this.hasAttribute("overlay")),
        )
        this.root.querySelector("button")!.textContent = this.paused
            ? "Resume visualisation"
            : "Pause visualisation"
        if (this.analyser && this.analyser.fftSize !== this.fftSize) {
            this.analyser.fftSize = this.fftSize
            this.data = new Uint8Array(this.fftSize)
        }
        this.updateSummary()
        this.syncLoop()
        if (!this.paused) this.render()
    }
    private measure() {
        const rect = this.canvas.getBoundingClientRect()
        this.width = Math.max(1, rect.width)
        this.height = Math.max(1, rect.height)
        const scale = Math.min(devicePixelRatio || 1, 2, 2048 / this.width, 2048 / this.height)
        this.canvas.width = Math.max(1, Math.round(this.width * scale))
        this.canvas.height = Math.max(1, Math.round(this.height * scale))
        this.context?.setTransform(
            this.canvas.width / this.width,
            0,
            0,
            this.canvas.height / this.height,
            0,
            0,
        )
        this.render()
    }
    /** Observe a source in its existing graph; never create a context or route to speakers. */
    connectSource(context: BaseAudioContext, source: AudioNode) {
        this.disconnectSource()
        this.attachSource(context, source)
    }
    private attachSource(context: BaseAudioContext, source: AudioNode) {
        if (this.sourceContext === context && this.source === source && this.analyser) return
        this.detachSource()
        if (this.kind !== "waveform" && this.kind !== "spectrum") return
        this.sourceContext = context
        this.source = source
        this.externalData = undefined
        this.analyser = context.createAnalyser()
        this.analyser.fftSize = this.fftSize
        this.data = new Uint8Array(this.fftSize)
        source.connect(this.analyser)
        this.updateSummary()
        this.syncLoop()
    }
    disconnectSource() {
        this.unobserveOutput?.()
        this.unobserveOutput = undefined
        this.selectedContext = null
        this.detachSource()
    }
    private detachSource() {
        if (this.source && this.analyser) {
            try {
                this.source.disconnect(this.analyser)
            } catch {
                /* Already detached by its owner. */
            }
            this.analyser.disconnect()
        }
        this.source = undefined
        this.sourceContext = undefined
        this.analyser = undefined
        this.signalState = ""
        this.removeAttribute("data-audio-playing")
        this.updateSummary()
        this.render()
        this.syncLoop()
    }
    /** Optional offline/sample feed for previews; values use Web Audio's byte scale 0–255. */
    setSamples(samples: Iterable<number>) {
        this.externalData = Uint8Array.from([...samples].slice(0, 32768))
        this.updateSummary()
        this.render()
    }
    noteOn(input: InstrumentNote | number, velocity = 1, time = performance.now() / 1000, id = 0) {
        const note = instrumentNote(input)
        const key = `${id}:${note.noteNumber}`
        if (this.voices.has(key)) return
        const voice: Voice = {
            note,
            velocity: Math.max(0, Math.min(1, Number.isFinite(velocity) ? velocity : 1)),
            colour:
                typeof input === "object" && "colour" in input ? String(input.colour) : undefined,
        }
        this.voices.set(key, voice)
        if (["horizontal-bars", "vertical-bars", "song"].includes(this.kind)) {
            this.segments.push({ ...voice, key, start: performance.now() / 1000 })
            if (this.segments.length > 512) this.segments.splice(0, this.segments.length - 512)
        }
        void time // Existing note visualisers accept engine-relative timestamps.
        this.updateSummary()
        if (!this.paused) this.render()
        this.syncLoop()
    }
    noteOff(input: InstrumentNote | number, _velocity = 0, _time = 0, id = 0) {
        const note = instrumentNote(input)
        const key = `${id}:${note.noteNumber}`
        this.voices.delete(key)
        const segment = [...this.segments]
            .reverse()
            .find((item) => item.key === key && item.end === undefined)
        if (segment) segment.end = performance.now() / 1000
        this.updateSummary()
        if (!this.paused) this.render()
        this.syncLoop()
    }
    setActiveNote(note: InstrumentNote | number, active = true) {
        if (active) this.noteOn(note)
        else this.noteOff(note)
    }
    setActiveNotes(notes: Iterable<InstrumentNote | number>) {
        const next = new Map<string, InstrumentNote>(
            [...notes].map((input) => {
                const note = instrumentNote(input)
                return [`0:${note.noteNumber}`, note] as const
            }),
        )
        for (const [key, voice] of this.voices) {
            if (!next.has(key)) this.noteOff(voice.note, 0, 0, Number(key.split(":")[0]))
        }
        for (const note of next.values()) this.noteOn(note)
    }
    clearActiveNotes() {
        for (const segment of this.segments)
            if (segment.end === undefined) segment.end = performance.now() / 1000
        this.voices.clear()
        this.updateSummary()
        if (!this.paused) this.render()
        this.syncLoop()
    }
    clear() {
        this.voices.clear()
        this.segments = []
        this.externalData = undefined
        this.updateSummary()
        this.render()
        this.syncLoop()
    }
    loadRecording(
        records: Iterable<{
            note: InstrumentNote | number | { number: number }
            velocity?: number
            playing?: boolean
        }>,
    ) {
        this.clear()
        for (const record of [...records].slice(-512)) {
            try {
                if (record.playing !== false) {
                    // Persisted legacy Note objects store the MIDI pitch as `number`.
                    const input = record.note
                    const note =
                        typeof input === "number"
                            ? input
                            : "noteNumber" in input
                              ? input.noteNumber
                              : input.number
                    this.noteOn(note, record.velocity)
                    this.noteOff(note)
                }
            } catch {
                /* Ignore historical entries without a valid MIDI note. */
            }
        }
    }
    private updateSummary() {
        const names = [...new Set([...this.voices.values()].map((voice) => voice.note.noteName))]
        this.root.querySelector(".summary")!.textContent = names.length
            ? `Active notes: ${names.join(", ")}`
            : this.kind === "waveform" || this.kind === "spectrum"
              ? this.analyser || this.externalData
                  ? this.signalState || "Audio signal visualisation"
                  : "Waiting for an audio source"
              : "No active notes"
    }
    private cancelFrame() {
        if (this.frame !== undefined) cancelAnimationFrame(this.frame)
        this.frame = undefined
    }
    private syncLoop() {
        this.cancelFrame()
        if (
            !this.isConnected ||
            this.paused ||
            this.hidden ||
            !this.visible ||
            this.suspended ||
            this.ownerDocument.hidden ||
            this.motion.matches
        )
            return
        const animate =
            this.kind === "waveform" || this.kind === "spectrum"
                ? !!this.analyser
                : ["horizontal-bars", "vertical-bars"].includes(this.kind) &&
                  (this.voices.size > 0 ||
                      this.segments.some(
                          (segment) =>
                              segment.end === undefined ||
                              performance.now() / 1000 - segment.end < 8,
                      ))
        if (!animate) return
        this.frame = requestAnimationFrame(() => {
            this.frame = undefined
            this.render()
            this.syncLoop()
        })
    }
    /** Draw one frame. Safe while paused/reduced-motion for explicit snapshots. */
    render() {
        const ctx = this.context
        if (!ctx || !this.kind) return
        const w = this.width,
            h = this.height,
            now = performance.now() / 1000
        const css = getComputedStyle(this.canvas)
        const line = this.forcedColours.matches
            ? css.color
            : this.tint ||
              css.getPropertyValue("--stroke").trim() ||
              css.getPropertyValue("--accent-color").trim() ||
              css.color ||
              "#e4b4ff"
        ctx.clearRect(0, 0, w, h)
        ctx.globalCompositeOperation = this.blend
        ctx.lineWidth = Math.max(1, parseFloat(css.getPropertyValue("--line-width")) || 3)
        ctx.strokeStyle = line
        ctx.fillStyle = line
        const noteColour = (voice: Voice) =>
            this.forcedColours.matches
                ? line
                : css.getPropertyValue("--fill").trim() || voice.colour || line
        if (this.kind === "waveform" || this.kind === "spectrum") {
            let data = this.externalData
            if (this.analyser) {
                if (this.kind === "waveform") this.analyser.getByteTimeDomainData(this.data)
                else this.analyser.getByteFrequencyData(this.data)
                data =
                    this.kind === "spectrum"
                        ? this.data.subarray(0, this.analyser.frequencyBinCount)
                        : this.data
                const playing =
                    this.sourceContext?.state !== "suspended" &&
                    this.sourceContext?.state !== "closed" &&
                    data.some((value) =>
                        this.kind === "spectrum" ? value > 0 : Math.abs(value - 128) > 1,
                    )
                const state = playing ? "Audio playing" : "No audio signal"
                if (state !== this.signalState) {
                    this.signalState = state
                    this.toggleAttribute("data-audio-playing", playing)
                    this.updateSummary()
                }
            }
            if (!data?.length) return
            if (this.kind === "waveform") {
                ctx.beginPath()
                data.forEach((value, index) => {
                    const x = (index / Math.max(1, data.length - 1)) * w,
                        y = (value / 255) * h
                    if (!index) ctx.moveTo(x, y)
                    else ctx.lineTo(x, y)
                })
                ctx.stroke()
            } else {
                const count = Math.min(64, data.length),
                    bar = w / count
                for (let index = 0; index < count; index++) {
                    const start = Math.floor((index * data.length) / count)
                    const end = Math.floor(((index + 1) * data.length) / count)
                    let peak = 0
                    for (let bin = start; bin < end; bin++) peak = Math.max(peak, data[bin]!)
                    const value = peak / 255
                    ctx.fillRect(index * bar, h - value * h, Math.max(1, bar - 2), value * h)
                }
            }
        } else if (this.kind === "pointer") {
            if (!this.pointer.visible) return
            const voices = [...this.voices.values()],
                radius = this.pointer.pressed ? 28 : 20
            ctx.beginPath()
            ctx.arc(this.pointer.x, this.pointer.y, radius, 0, Math.PI * 2)
            ctx.stroke()
            voices.forEach((voice, index) => {
                ctx.fillStyle = noteColour(voice)
                ctx.beginPath()
                ctx.moveTo(this.pointer.x, this.pointer.y)
                ctx.arc(
                    this.pointer.x,
                    this.pointer.y,
                    radius - 3,
                    (index / voices.length) * Math.PI * 2,
                    ((index + 1) / voices.length) * Math.PI * 2,
                )
                ctx.closePath()
                ctx.fill()
            })
        } else {
            const range = this.max - this.min + 1
            this.segments.forEach((segment, index) => {
                if (segment.note.noteNumber < this.min || segment.note.noteNumber > this.max) return
                const pitch = (segment.note.noteNumber - this.min) / range
                ctx.fillStyle = noteColour(segment)
                ctx.globalAlpha = 0.3 + segment.velocity * 0.7
                if (this.kind === "song") {
                    const x = (index / Math.max(64, this.segments.length)) * w
                    ctx.fillRect(
                        x,
                        (1 - pitch) * h - h / range,
                        Math.max(2, w / Math.max(64, this.segments.length)),
                        Math.max(1, h / range),
                    )
                } else {
                    const age = now - segment.start,
                        endAge = segment.end === undefined ? 0 : now - segment.end
                    const extent = this.kind === "horizontal-bars" ? w : h
                    const start = Math.min(extent, (age / 8) * extent),
                        end = Math.max(0, (endAge / 8) * extent)
                    if (end >= extent) return
                    if (this.kind === "horizontal-bars")
                        ctx.fillRect(
                            w - start,
                            (1 - pitch) * h - h / range,
                            Math.max(2, start - end),
                            Math.max(1, h / range),
                        )
                    else
                        ctx.fillRect(
                            pitch * w,
                            h - start,
                            Math.max(1, w / range),
                            Math.max(2, start - end),
                        )
                }
            })
            ctx.globalAlpha = 1
        }
        ctx.globalCompositeOperation = "source-over"
    }
}

