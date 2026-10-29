import { AudioNodeVisualiser, disconnectTap } from "../../shared/audio-node-visualiser.ts"

export class SpectrumVisualiser extends AudioNodeVisualiser {
    private analyser?: AnalyserNode
    private data = new Uint8Array(1024)
    private peaks = new Float32Array(64)
    private context: CanvasRenderingContext2D | null

    constructor() {
        super("Audio frequency spectrum, from bass on the left to treble on the right")
        this.context = this.canvas.getContext("2d")
    }
    protected async prepare(source: AudioNode) {
        if (!this.context) throw new Error("Canvas 2D is unavailable")
        const analyser = source.context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        this.analyser = analyser
        this.peaks.fill(0)
        return () => {
            disconnectTap(source, analyser)
            if (this.analyser === analyser) {
                this.analyser = undefined
                this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height)
            }
        }
    }
    protected renderFrame() {
        const ctx = this.context
        const analyser = this.analyser
        if (!ctx || !analyser) return
        analyser.getByteFrequencyData(this.data)
        const { width, height } = this.canvas
        ctx.fillStyle = "#090d19"
        ctx.fillRect(0, 0, width, height)
        const gradient = ctx.createLinearGradient(0, height, 0, 0)
        gradient.addColorStop(0, "#38bdf8")
        gradient.addColorStop(0.55, "#a78bfa")
        gradient.addColorStop(1, "#fb7185")
        const minBin = Math.max(
            1,
            Math.floor((30 * analyser.fftSize) / analyser.context.sampleRate),
        )
        const maxBin = Math.min(
            this.data.length,
            Math.ceil((20000 * analyser.fftSize) / analyser.context.sampleRate),
        )
        const count = this.peaks.length
        for (let i = 0; i < count; i++) {
            const start = Math.floor(minBin * (maxBin / minBin) ** (i / count))
            const end = Math.min(
                this.data.length,
                Math.max(start + 1, Math.ceil(minBin * (maxBin / minBin) ** ((i + 1) / count))),
            )
            let level = 0
            for (let bin = start; bin < end; bin++) level = Math.max(level, this.data[bin] / 255)
            this.peaks[i] = Math.max(level, this.peaks[i] - 0.012)
            const x = (i * width) / count
            const barWidth = Math.max(1, width / count - 2)
            ctx.fillStyle = gradient
            ctx.fillRect(x, height - level * (height - 12), barWidth, level * (height - 12))
            ctx.fillStyle = "#e0e7ff"
            ctx.fillRect(x, height - this.peaks[i] * (height - 12) - 2, barWidth, 2)
        }
    }
}

if (!customElements.get("spectrum-visualiser"))
    customElements.define("spectrum-visualiser", SpectrumVisualiser)

declare global {
    interface HTMLElementTagNameMap {
        "spectrum-visualiser": SpectrumVisualiser
    }
}