import { AudioAnalysis } from "../../../visualisation/AudioAnalysis.ts"
import { drawSpectrum } from "../../../visualisation/renderers/CanvasSignalRenderer.ts"
import { AudioNodeVisualiser } from "../../shared/audio-node-visualiser.ts"

export class SpectrumVisualiser extends AudioNodeVisualiser {
	private analysis?: AudioAnalysis
	private peaks = new Float32Array(64)
	private context: CanvasRenderingContext2D | null

	constructor() {
		super("Audio frequency spectrum, from bass on the left to treble on the right")
		this.context = this.canvas.getContext("2d")
	}
	protected async prepare(source: AudioNode) {
		if (!this.context) {
			throw new Error("Canvas 2D is unavailable")
		}
		const analysis = new AudioAnalysis(source.context, 2048, 0.8)
		analysis.observe(source)
		this.analysis = analysis
		this.peaks.fill(0)
		return () => {
			analysis.dispose()
			if (this.analysis === analysis) {
				this.analysis = undefined
				this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height)
			}
		}
	}
	protected renderFrame() {
		const ctx = this.context
		const analysis = this.analysis
		if (!ctx || !analysis) {
			return
		}
		const analyser = analysis.analyser
		const data = analysis.read("frequency")
		const { width, height } = this.canvas
		ctx.fillStyle = "#090d19"
		ctx.fillRect(0, 0, width, height)
		const gradient = ctx.createLinearGradient(0, height, 0, 0)
		gradient.addColorStop(0, "#38bdf8")
		gradient.addColorStop(0.55, "#a78bfa")
		gradient.addColorStop(1, "#fb7185")
		const minBin = Math.max(
			1,
			Math.floor((30 * analyser.fftSize) / analyser.context.sampleRate)
		)
		const maxBin = Math.min(
			data.length,
			Math.ceil((20000 * analyser.fftSize) / analyser.context.sampleRate)
		)
		ctx.fillStyle = gradient
		drawSpectrum(ctx, data, width, height, {
			bars: this.peaks.length,
			minBin,
			maxBin,
			logarithmic: true,
			peaks: this.peaks,
			headroom: 12
		})
	}
}

if (!customElements.get("spectrum-visualiser")) {
	customElements.define("spectrum-visualiser", SpectrumVisualiser)
}

declare global {
	interface HTMLElementTagNameMap {
		"spectrum-visualiser": SpectrumVisualiser
	}
}