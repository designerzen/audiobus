import PhotoSynthOutput, {
	commonParameters,
	numeric,
	pitchControl,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph
} from "../../instruments/photosynth/output-base.ts"
import { EQUATION_WAVES } from "../../instruments/equations/equation-waves.ts"
import { zetaSpectrum } from "../../instruments/zeta/zeta-wave.ts"
import { EVENT_CHANGE, EVENT_CONFIGURATION_CHANGED } from "../../events/event-constants.ts"

export interface EquationSettings extends CommonSettings {
	equation: number
	a: number
	b: number
}
export type EquationOptions = OutputOptions<EquationSettings>
const parameters: Parameters<EquationSettings> = {
	...commonParameters,
	equation: numeric(0, 0, EQUATION_WAVES.length - 1, 1),
	a: numeric(0.5, 0, 1, 0.001),
	b: numeric(0.5, 0, 1, 0.001)
}
const CYCLE_SIZE = 4096

/** Plays one cycle of a chosen equation as a band-limited periodic wave */
export default class OutputEquations extends PhotoSynthOutput<EquationSettings> {
	readonly name = "Equations"
	readonly description =
		"Waveforms from Fourier series, special functions, curves, chaos and number theory"
	private wave?: PeriodicWave
	private waveKey?: string
	private controlsEvents?: AbortController
	private analyser?: AnalyserNode
	private frame = 0

	constructor(options: EquationOptions) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { equation, a, b } = this.settings
		const key = JSON.stringify([equation, a, b])
		if (!this.wave || key !== this.waveKey) {
			const { real, imag } = zetaSpectrum(EQUATION_WAVES[equation].render(CYCLE_SIZE, a, b))
			this.wave = this.context.createPeriodicWave(real, imag)
			this.waveKey = key
		}
		const oscillator = this.context.createOscillator()
		oscillator.setPeriodicWave(this.wave)
		oscillator.connect(input)
		return {
			nodes: [],
			sources: [oscillator],
			pitch: pitchControl(this.context, oscillator.frequency)
		}
	}
	async createGui(): Promise<HTMLElement> {
		const panel = await super.createGui()
		if (panel.querySelector("select[name=equation]")) {
			return panel
		}
		this.controlsEvents = new AbortController()
		const input = panel.querySelector<HTMLInputElement>("input[name=equation]")!
		const select = document.createElement("select")
		select.name = "equation"
		for (const [value, { title }] of EQUATION_WAVES.entries()) {
			const option = document.createElement("option")
			option.value = String(value)
			option.textContent = title
			select.append(option)
		}
		input.replaceWith(select)
		const signal = this.controlsEvents.signal
		select.addEventListener(
			EVENT_CHANGE,
			() => this.configure({ equation: Number(select.value) }),
			{ signal }
		)
		const update = () => {
			select.value = String(this.settings.equation)
		}
		this.addEventListener(EVENT_CONFIGURATION_CHANGED, update, { signal })
		update()
		panel.append(this.createPlot(signal))
		const help = document.createElement("p")
		help.textContent =
			"Each equation draws one cycle per note; a and b shape it. Changes apply to new notes."
		panel.append(help)
		return panel
	}
	/** Draws the selected cycle, with a live scope of the output over it while notes sound */
	private createPlot(signal: AbortSignal): HTMLCanvasElement {
		const canvas = document.createElement("canvas")
		canvas.setAttribute("role", "img")
		canvas.style.cssText =
			"display:block;inline-size:100%;block-size:8rem;color:var(--col-accent, currentColor)"
		const context = canvas.getContext("2d")!
		this.analyser = this.context.createAnalyser()
		this.analyser.fftSize = 2048
		this.output.connect(this.analyser)
		const scope = new Float32Array(this.analyser.fftSize)
		let cycle: Float64Array = new Float64Array(0)
		let cycleKey = ""
		const draw = () => {
			this.frame = requestAnimationFrame(draw)
			const { equation, a, b } = this.settings
			const key = JSON.stringify([equation, a, b])
			if (key !== cycleKey) {
				cycle = EQUATION_WAVES[equation].render(512, a, b)
				cycleKey = key
				canvas.setAttribute("aria-label", EQUATION_WAVES[equation].title + " waveform")
			}
			const ratio = devicePixelRatio || 1
			const width = Math.round(canvas.clientWidth * ratio)
			const height = Math.round(canvas.clientHeight * ratio)
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width
				canvas.height = height
			}
			context.clearRect(0, 0, width, height)
			context.strokeStyle = getComputedStyle(canvas).color
			context.lineWidth = 2 * ratio
			this.trace(context, cycle, width, height)
			this.analyser!.getFloatTimeDomainData(scope)
			if (scope.some((value) => Math.abs(value) > 1e-4)) {
				context.globalAlpha = 0.45
				context.lineWidth = ratio
				this.trace(context, scope, width, height)
				context.globalAlpha = 1
			}
		}
		draw()
		signal.addEventListener("abort", () => {
			cancelAnimationFrame(this.frame)
			this.output.disconnect(this.analyser!)
			this.analyser = undefined
		})
		return canvas
	}
	/** Strokes values scaled to fill the canvas height */
	private trace(
		context: CanvasRenderingContext2D,
		values: ArrayLike<number>,
		width: number,
		height: number
	): void {
		let low = Infinity
		let high = -Infinity
		for (let index = 0; index < values.length; index++) {
			low = Math.min(low, values[index])
			high = Math.max(high, values[index])
		}
		const range = high - low || 1
		const margin = context.lineWidth
		context.beginPath()
		for (let index = 0; index < values.length; index++) {
			const x = (index / (values.length - 1)) * width
			const y = margin + (1 - (values[index] - low) / range) * (height - margin * 2)
			if (index) {
				context.lineTo(x, y)
			} else {
				context.moveTo(x, y)
			}
		}
		context.stroke()
	}
	async destroyGui(): Promise<void> {
		this.controlsEvents?.abort()
		await super.destroyGui()
	}
}