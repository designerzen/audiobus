import { RenderSurface } from "./renderers/RenderSurface.ts"

/** Logarithmic filter response from 20 Hz to Nyquist, with dB magnitude and phase. */
export class FilterDisplay {
	private canvas: HTMLCanvasElement
	private surface: RenderSurface
	private frequencies: Float32Array<ArrayBuffer>
	private magnitude: Float32Array<ArrayBuffer>
	private phase: Float32Array<ArrayBuffer>
	private magnitudeLine: Uint8Array<ArrayBuffer>
	private phaseLine: Uint8Array<ArrayBuffer>
	private sampleRate = 0
	get element(): HTMLCanvasElement {
		return this.canvas
	}
	get ready(): Promise<void> {
		return this.surface.ready
	}
	get backend() {
		return this.surface.backend
	}
	constructor(width: number, height: number, bars = 256) {
		if (!Number.isInteger(bars) || bars < 2 || bars > 32768) {
			throw new RangeError("Response resolution must be between 2 and 32768")
		}
		this.canvas = document.createElement("canvas")
		this.canvas.setAttribute("role", "img")
		this.canvas.setAttribute(
			"aria-label",
			"Filter frequency response: magnitude and phase, 20 Hz to Nyquist"
		)
		this.setSize(width, height)
		this.surface = new RenderSurface(this.canvas)
		this.frequencies = new Float32Array(bars)
		this.magnitude = new Float32Array(bars)
		this.phase = new Float32Array(bars)
		this.magnitudeLine = new Uint8Array(bars)
		this.phaseLine = new Uint8Array(bars)
	}
	setSize(width: number, height: number): void {
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			throw new RangeError("Canvas size must be positive")
		}
		const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
		this.canvas.width = Math.min(4096, Math.max(1, Math.round(width * ratio)))
		this.canvas.height = Math.min(4096, Math.max(1, Math.round(height * ratio)))
		this.canvas.style.width = `${width}px`
		this.canvas.style.height = `${height}px`
	}
	updateFrequencyResponse(filter: BiquadFilterNode): void {
		if (this.sampleRate !== filter.context.sampleRate) {
			this.sampleRate = filter.context.sampleRate
			const max = this.sampleRate / 2
			const min = Math.min(20, max / 2)
			for (let i = 0; i < this.frequencies.length; i++) {
				this.frequencies[i] = min * (max / min) ** (i / (this.frequencies.length - 1))
			}
		}
		filter.getFrequencyResponse(this.frequencies, this.magnitude, this.phase)
		for (let i = 0; i < this.frequencies.length; i++) {
			const db = 20 * Math.log10(Math.max(1e-6, this.magnitude[i]))
			this.magnitudeLine[i] = Math.round(Math.max(0, Math.min(1, (24 - db) / 84)) * 255)
			this.phaseLine[i] = Math.round(
				Math.max(0, Math.min(1, (Math.PI - this.phase[i]) / (2 * Math.PI))) * 255
			)
		}
		const render = () => {
			this.surface.beginFrame()
			for (const [data, colour] of [
				[this.magnitudeLine, [0.4, 0.85, 1, 1]],
				[this.phaseLine, [1, 0.4, 0.55, 0.8]]
			] as const) {
				this.surface.add({
					mode: "scope",
					data,
					colour,
					time: 0,
					thickness: 2,
					amplitude: 0,
					decay: 0,
					ratios: [0, 0, 0],
					phases: [0, 0, 0]
				})
			}
			this.surface.endFrame()
		}
		if (this.backend === "pending") {
			void this.ready.then(render)
		} else {
			render()
		}
	}
	dispose(): void {
		this.surface.dispose()
	}
}