import PhotoSynthOutput, {
	commonParameters,
	pitchControl,
	numeric,
	noiseBuffer,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph
} from "../../instruments/photosynth/output-base.ts"

/** Equation selected by the `equation` setting, in this order */
export const PDE_EQUATIONS = [
	"heat",
	"wave",
	"maxwell",
	"euler",
	"schrodinger",
	"elastodynamics",
	"reaction-diffusion"
] as const

export interface PdeSettings extends CommonSettings {
	equation: number
	partials: number
	diffusivity: number
	damping: number
	position: number
	growth: number
}
export type PdeOptions = OutputOptions<PdeSettings>
const parameters: Parameters<PdeSettings> = {
	...commonParameters,
	equation: numeric(0, 0, PDE_EQUATIONS.length - 1, 1),
	partials: numeric(12, 1, 32, 1),
	diffusivity: numeric(0.5, 0.01, 10),
	damping: numeric(1, 0.01, 10),
	position: numeric(0.2, 0.01, 0.99),
	growth: numeric(4, 0.1, 40, 0.1)
}

/** Cantilever beam eigenvalues βₙL; frequency ratios follow (βₙ/β₁)², so f₂/f₁ ≈ 6.267 */
const BEAM_ROOTS = [1.8751, 4.6941, 7.8548, 10.9955, 14.1372, 17.2788, 20.4204, 23.5619]

interface Partial {
	ratio: number
	amplitude: number
	/** Seconds for the partial to fall by 1/e, or Infinity to sustain */
	decay: number
}

/**
 * Seven classical PDEs voiced as modal syntheses: each equation's
 * eigenmodes become partials whose ratios and decay rates come from
 * its dispersion relation.
 */
function partialsFor(settings: PdeSettings): Partial[] {
	const { partials: count, diffusivity, damping, position } = settings
	const modes = Array.from({ length: count }, (_, index) => index + 1)
	switch (PDE_EQUATIONS[settings.equation]) {
		case "heat":
			// A hotspot is a delta: every mode starts equal, then decays as e^(−αk²t).
			return modes.map((n) => ({
				ratio: n,
				amplitude: 1 / count,
				decay: 1 / (diffusivity * n * n)
			}))
		case "wave":
			// Two pulses at ±position superpose; mode n carries sin(nπx₁) + sin(nπx₂).
			return modes.map((n) => ({
				ratio: n,
				amplitude:
					(Math.sin(n * Math.PI * position) + Math.sin(n * Math.PI * (1 - position))) /
					(n * 2),
				decay: 4 / (damping * n)
			}))
		case "maxwell":
			// Dipole radiation: power ∝ ω⁴, loops detach twice per cycle.
			return [
				{ ratio: 1, amplitude: 0.6, decay: Infinity },
				{ ratio: 2, amplitude: 0.3, decay: Infinity },
				{ ratio: 3, amplitude: 0.1 / damping, decay: 2 / damping }
			]
		case "euler":
			// Kutta condition sets circulation; inviscid flow keeps the fundamental.
			return modes.map((n) => ({
				ratio: n + (n > 1 ? position * 0.03 * n : 0),
				amplitude: 1 / (n * n),
				decay: n === 1 ? Infinity : 3 / damping
			}))
		case "schrodinger":
			// Free-particle dispersion ω ∝ k²: a Gaussian packet of k around k₀ spreads.
			return modes.map((n) => {
				const k = 1 + (n - 1) / Math.max(1, count - 1)
				const width = 0.25 + position
				return {
					ratio: k * k,
					amplitude: Math.exp(-(((k - 1.5) / width) ** 2)) / Math.sqrt(count),
					decay: 2 / (diffusivity * k)
				}
			})
		case "elastodynamics":
			// Euler–Bernoulli cantilever: inharmonic ratios, higher modes damp faster.
			return BEAM_ROOTS.slice(0, Math.min(count, BEAM_ROOTS.length)).map((root, index) => {
				const ratio = (root / BEAM_ROOTS[0]) ** 2
				return {
					ratio,
					amplitude: 1 / (index + 1) ** 1.5,
					decay: 3 / (damping * Math.sqrt(ratio))
				}
			})
		default:
			// Reaction-diffusion: diffusion damps modes, logistic growth (see buildVoice) swells them.
			return modes.map((n) => ({
				ratio: n,
				amplitude: 1 / n,
				decay: Math.max(0.05, 4 / (diffusivity * n * n))
			}))
	}
}

export default class OutputPde extends PhotoSynthOutput<PdeSettings> {
	readonly name = "PDE"
	readonly description = "Modal synthesis of seven classical partial differential equations"
	constructor(options: PdeOptions) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { context, settings } = this
		const now = context.currentTime
		const equation = PDE_EQUATIONS[settings.equation]
		const bus = context.createGain()
		const filter = context.createBiquadFilter()
		const nodes: AudioNode[] = [bus, filter]
		const sources: AudioScheduledSourceNode[] = []
		const pitches: ((frequency: number) => void)[] = []
		const nyquist = context.sampleRate / 2
		filter.type = "lowpass"
		filter.frequency.setValueAtTime(Math.min(2000, nyquist), now)
		filter.Q.setValueAtTime(0.7, now)
		bus.connect(filter)
		filter.connect(input)

		if (equation === "reaction-diffusion") {
			// Logistic u(t) = 1 / (1 + (1/u₀ − 1)e^(−rt)), drawn as linear segments.
			const r = settings.growth
			bus.gain.setValueAtTime(0.01, now)
			for (let step = 1; step <= 16; step++) {
				const time = (step / 16) * (8 / r)
				bus.gain.linearRampToValueAtTime(1 / (1 + 99 * Math.exp(-r * time)), now + time)
			}
		} else {
			bus.gain.setValueAtTime(1, now)
		}

		for (const partial of partialsFor(settings)) {
			const oscillator = context.createOscillator()
			const gain = context.createGain()
			gain.gain.setValueAtTime(partial.amplitude, now)
			if (Number.isFinite(partial.decay)) {
				gain.gain.setTargetAtTime(0, now, partial.decay)
			}
			oscillator.connect(gain)
			gain.connect(bus)
			nodes.push(gain)
			sources.push(oscillator)
			const pitch = pitchControl(context, oscillator.frequency)
			pitches.push((frequency) => pitch(Math.min(frequency * partial.ratio, nyquist)))
		}

		if (equation === "euler") {
			// Wake turbulence: band-passed noise tracking the fundamental.
			const noise = context.createBufferSource()
			const band = context.createBiquadFilter()
			const level = context.createGain()
			noise.buffer = noiseBuffer(context, 1)
			noise.loop = true
			band.type = "bandpass"
			band.Q.setValueAtTime(8, now)
			level.gain.setValueAtTime(0.15, now)
			noise.connect(band)
			band.connect(level)
			level.connect(bus)
			nodes.push(band, level)
			sources.push(noise)
			const pitch = pitchControl(context, band.frequency)
			pitches.push((frequency) => pitch(Math.min(frequency * 2, nyquist)))
		}

		return {
			nodes,
			sources,
			pitch: (frequency) => {
				for (const pitch of pitches) {
					pitch(frequency)
				}
			},
			modulate: (value) =>
				filter.frequency.setTargetAtTime(
					Math.min(2000 + value * 18000, nyquist),
					context.currentTime,
					0.005
				)
		}
	}
}