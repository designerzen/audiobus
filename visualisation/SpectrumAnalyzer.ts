import { Visualiser } from "./visualisers/Visualiser.ts"
import { RenderSurface } from "./renderers/RenderSurface.ts"

/** Owns audio analysis, one animation loop, and a chain of GPU-rendered layers. */
export class SpectrumAnalyzer {
	static readonly TYPE_FREQUENCY = "frequency"
	static readonly TYPE_TIME_DOMAIN = "fft"
	readonly analyser: AnalyserNode
	frequencyData = new Uint8Array(0)
	private waveformData = new Uint8Array(0)
	canvas!: HTMLCanvasElement
	head?: Visualiser
	tail?: Visualiser
	onanalysis: ((data: Uint8Array<ArrayBuffer>) => void) | null = null
	private surface?: RenderSurface
	private frame?: number
	private running = false
	private disposed = false
	private sources = new Set<AudioNode>()
	private observer?: ResizeObserver
	private logicalWidth = 256
	private logicalHeight = 256
	get ready(): Promise<void> {
		return this.surface?.ready ?? Promise.resolve()
	}
	get backend() {
		return this.surface?.backend ?? "pending"
	}
	constructor(
		audioContext: BaseAudioContext,
		private type = SpectrumAnalyzer.TYPE_FREQUENCY,
		fftSize = 1024
	) {
		if (![SpectrumAnalyzer.TYPE_FREQUENCY, SpectrumAnalyzer.TYPE_TIME_DOMAIN].includes(type)) {
			throw new RangeError("Unknown analysis type")
		}
		this.analyser = audioContext.createAnalyser()
		this.analyser.smoothingTimeConstant = 0.85
		this.setFidelity(fftSize)
	}
	setFidelity(fftSize: number): void {
		this.analyser.fftSize = fftSize
		this.frequencyData = new Uint8Array(
			this.type === SpectrumAnalyzer.TYPE_TIME_DOMAIN
				? fftSize
				: this.analyser.frequencyBinCount
		)
		this.waveformData = new Uint8Array(fftSize)
	}
	/** Observe without creating an extra audible path to the destination. */
	observe(source: AudioNode): void {
		if (!this.sources.has(source)) {
			source.connect(this.analyser)
			this.sources.add(source)
		}
	}
	/** Explicit pass-through routing retained for callers using the analyser in their graph. */
	connect(outputTo: AudioNode, source?: AudioNode): void {
		if (source) {
			this.observe(source)
		}
		this.analyser.connect(outputTo)
	}
	createCanvas(width = 256, height = 256, id = "audiobus-visualiser"): HTMLCanvasElement {
		const existing = document.getElementById(id)
		if (existing && !(existing instanceof HTMLCanvasElement)) {
			throw new TypeError("Visualiser ID belongs to a non-canvas element")
		}
		const canvas = (existing as HTMLCanvasElement | null) ?? document.createElement("canvas")
		canvas.id = id
		canvas.classList.add("audiobus-visualisation")
		canvas.setAttribute("role", "img")
		canvas.setAttribute("aria-label", "Audio visualisation")
		if (!existing) {
			document.body.appendChild(canvas)
		}
		this.setCanvas(canvas)
		this.setSize(width, height)
		return canvas
	}
	setCanvas(canvas: HTMLCanvasElement): void {
		if (this.canvas === canvas) {
			return
		}
		this.observer?.disconnect()
		this.surface?.dispose()
		this.canvas = canvas
		this.surface = new RenderSurface(canvas)
		for (const vis of this.visualisers()) {
			vis.setCanvas(canvas, this.surface)
		}
		if (typeof ResizeObserver !== "undefined") {
			this.observer = new ResizeObserver(([entry]) => {
				if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
					this.resize(entry.contentRect.width, entry.contentRect.height)
				}
			})
			this.observer.observe(canvas)
		}
	}
	checkCanvasExists(id: string): boolean {
		return document.getElementById(id) instanceof HTMLCanvasElement
	}
	private resize(width: number, height: number): void {
		this.logicalWidth = width
		this.logicalHeight = height
		const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
		const w = Math.min(4096, Math.max(1, Math.round(width * ratio)))
		const h = Math.min(4096, Math.max(1, Math.round(height * ratio)))
		if (this.canvas.width !== w) {
			this.canvas.width = w
		}
		if (this.canvas.height !== h) {
			this.canvas.height = h
		}
	}
	setSize(width = 256, height = 256): void {
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			throw new RangeError("Canvas size must be positive")
		}
		this.canvas.style.width = `${width}px`
		this.canvas.style.height = `${height}px`
		this.resize(width, height)
	}
	private *visualisers(): Generator<Visualiser> {
		const seen = new Set<Visualiser>()
		for (let vis = this.head; vis && !seen.has(vis); vis = vis.next) {
			seen.add(vis)
			yield vis
		}
	}
	remove(vis: Visualiser): void {
		if (![...this.visualisers()].includes(vis)) {
			return
		}
		if (this.head === vis) {
			this.head = vis.next
		}
		if (this.tail === vis) {
			this.tail = vis.previous
		}
		vis.unlink()
	}
	solo(vis: Visualiser): void {
		// Unlinking changes traversal links, so capture the chain before mutation.
		// eslint-disable-next-line unicorn/no-useless-spread
		for (const member of [...this.visualisers()]) {
			this.remove(member)
		}
		this.append(vis)
	}
	append(vis: Visualiser): void {
		this.remove(vis)
		vis.unlink()
		if (this.tail) {
			this.tail.next = vis
			vis.previous = this.tail
		} else {
			this.head = vis
		}
		this.tail = vis
		if (this.canvas) {
			vis.setCanvas(this.canvas, this.surface)
		}
	}
	prepend(vis: Visualiser): void {
		this.remove(vis)
		vis.unlink()
		if (this.head) {
			this.head.previous = vis
			vis.next = this.head
		} else {
			this.tail = vis
		}
		this.head = vis
		if (this.canvas) {
			vis.setCanvas(this.canvas, this.surface)
		}
	}
	start(): void {
		if (this.disposed) {
			throw new Error("Analyser has been disposed")
		}
		if (this.running) {
			return
		}
		this.running = true
		this.frame = requestAnimationFrame(this.update)
	}
	stop(): void {
		this.running = false
		if (this.frame !== undefined) {
			cancelAnimationFrame(this.frame)
		}
		this.frame = undefined
	}
	private update = (time: number): void => {
		this.frame = undefined
		if (!this.running) {
			return
		}
		try {
			if (typeof document === "undefined" || !document.hidden) {
				if (this.type === SpectrumAnalyzer.TYPE_FREQUENCY) {
					this.analyser.getByteFrequencyData(this.frequencyData)
				} else {
					this.analyser.getByteTimeDomainData(this.frequencyData)
				}
				const visualisers = [...this.visualisers()]
				if (visualisers.some((vis) => vis.dataDomain === "time")) {
					this.analyser.getByteTimeDomainData(this.waveformData)
				}
				if (this.canvas) {
					this.resize(this.logicalWidth, this.logicalHeight)
				}
				this.surface?.beginFrame()
				for (const vis of visualisers) {
					const data = vis.dataDomain === "time" ? this.waveformData : this.frequencyData
					vis.update(data, time, data.length)
				}
				this.surface?.endFrame()
				this.onanalysis?.(this.frequencyData)
			}
		} catch (error) {
			this.stop()
			throw error
		}
		if (this.running) {
			this.frame = requestAnimationFrame(this.update)
		}
	}
	dispose(): void {
		this.stop()
		this.disposed = true
		this.observer?.disconnect()
		for (const source of this.sources) {
			try {
				source.disconnect(this.analyser)
			} catch {
				/* Source may already be disconnected. */
			}
		}
		this.sources.clear()
		this.analyser.disconnect()
		// eslint-disable-next-line unicorn/no-useless-spread
		for (const vis of [...this.visualisers()]) {
			this.remove(vis)
			vis.dispose()
		}
		this.surface?.dispose()
		this.onanalysis = null
	}
}