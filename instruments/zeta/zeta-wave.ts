import { ZETA_ZEROS } from "./zeros"

export const ZETA_VARIATIONS = [
	"Real terms",
	"Imaginary terms (π removed)",
	"Cumulative real sum",
	"Cumulative imaginary sum (π removed)",
	"Cycle approximation"
] as const

export interface ZetaWaveSettings {
	variation: number
	n: number
	firstZero: number
	zeroCount: number
}

/**
 * Ei((1/2 + iγ) log n), with the limiting iπ removed.
 * This is the unwrapped logarithmic integral used by Baugh (arXiv:0712.0934),
 * not Ei(Log(n^ρ)) with a principal logarithm, which would fold the spiral.
 * Integrating -exp(z) ∫₀∞ exp(-s)/(s-z) ds avoids cancellation near iπ.
 */
export function zetaTerm(n: number, gamma: number): [number, number] {
	if (!Number.isFinite(n) || n < 2 || !Number.isFinite(gamma) || gamma <= 0) {
		throw new RangeError("Zeta terms require n ≥ 2 and a positive zero ordinate")
	}
	const x = Math.log(n) / 2
	const y = gamma * Math.log(n)
	if (y > 64) {
		// The asymptotic series converges to machine precision before truncation
		// at these ordinates; never continue into its divergent tail.
		const d = x * x + y * y
		const inverseReal = x / d,
			inverseImag = -y / d
		let termReal = inverseReal,
			termImag = inverseImag
		let sumReal = termReal,
			sumImag = termImag
		for (let k = 1; k <= 32; k++) {
			const nextReal = k * (termReal * inverseReal - termImag * inverseImag)
			termImag = k * (termReal * inverseImag + termImag * inverseReal)
			termReal = nextReal
			sumReal += termReal
			sumImag += termImag
			if (Math.hypot(termReal, termImag) < 1e-16 * Math.hypot(sumReal, sumImag)) {
				break
			}
		}
		return [
			Math.sqrt(n) * (Math.cos(y) * sumReal - Math.sin(y) * sumImag),
			Math.sqrt(n) * (Math.sin(y) * sumReal + Math.cos(y) * sumImag)
		]
	}
	let real = 0,
		imag = 0
	// Composite Simpson quadrature; the discarded exp(-40) tail is negligible.
	const steps = 1280,
		h = 40 / steps
	for (let j = 0; j <= steps; j++) {
		const s = j * h
		const d = (s - x) ** 2 + y * y
		const weight = (j === 0 || j === steps ? 1 : j % 2 ? 4 : 2) * Math.exp(-s)
		real += (weight * (s - x)) / d
		imag += (weight * y) / d
	}
	const scale = (-Math.sqrt(n) * h) / 3
	return [
		scale * (Math.cos(y) * real - Math.sin(y) * imag),
		scale * (Math.sin(y) * real + Math.cos(y) * imag)
	]
}

/** One point per consecutive zero; cumulative sums include all preceding zeros. */
export function zetaSequence(settings: ZetaWaveSettings): Float64Array {
	const { variation, n, firstZero, zeroCount } = settings
	if (
		!Number.isInteger(variation) ||
		variation < 0 ||
		variation >= ZETA_VARIATIONS.length ||
		!Number.isFinite(n) ||
		n < 2 ||
		n > 1e6 ||
		!Number.isInteger(firstZero) ||
		firstZero < 1 ||
		firstZero >= ZETA_ZEROS.length ||
		!Number.isInteger(zeroCount) ||
		zeroCount < 2
	) {
		throw new RangeError("Invalid Zeta waveform settings")
	}
	const count = Math.min(zeroCount, ZETA_ZEROS.length - firstZero + 1)
	const points = new Float64Array(count)
	if (variation === 4) {
		for (let j = 0; j < count; j++) {
			const x = 6 * Math.PI + (998 * Math.PI * j) / (count - 1)
			const phase = x ** (5 / 8)
			// Figure 2: 29.745 + sin(x^(5/8))/(3*x^(5/8)); omit DC for audio.
			points[j] = Math.sin(phase) / (3 * phase)
		}
		return points
	}
	let sum = 0
	const cumulative = variation === 2 || variation === 3
	const end = firstZero - 1 + count
	for (let j = cumulative ? 0 : firstZero - 1; j < end; j++) {
		const term = zetaTerm(n, ZETA_ZEROS[j])[variation % 2]
		sum = cumulative ? sum + term : term
		if (j >= firstZero - 1) {
			points[j - firstZero + 1] = sum
		}
	}
	return points
}

/** FFT of the zero-index trace; Web Audio's PeriodicWave removes inaudible harmonics. */
export function zetaSpectrum(points: Float64Array): { real: Float32Array; imag: Float32Array } {
	let size = 2
	while (size < points.length) {
		size *= 2
	}
	const re = new Float64Array(size),
		im = new Float64Array(size)
	for (let j = 0; j < size; j++) {
		const position = (j * points.length) / size
		const index = Math.floor(position),
			fraction = position - index
		re[j] = points[index] * (1 - fraction) + points[(index + 1) % points.length] * fraction
	}
	for (let j = 1, k = 0; j < size; j++) {
		let bit = size >> 1
		for (; k & bit; bit >>= 1) {
			k ^= bit
		}
		k ^= bit
		if (j < k) {
			;[re[j], re[k]] = [re[k], re[j]]
		}
	}
	for (let width = 2; width <= size; width *= 2) {
		for (let start = 0; start < size; start += width) {
			for (let j = 0; j < width / 2; j++) {
				const angle = (-2 * Math.PI * j) / width
				const a = start + j,
					b = a + width / 2
				const r = re[b] * Math.cos(angle) - im[b] * Math.sin(angle)
				const i = re[b] * Math.sin(angle) + im[b] * Math.cos(angle)
				re[b] = re[a] - r
				im[b] = im[a] - i
				re[a] += r
				im[a] += i
			}
		}
	}
	const length = Math.min(size / 2, 4095) + 1
	const real = new Float32Array(length),
		imag = new Float32Array(length)
	// DC is intentionally omitted. PeriodicWave normalizes the remaining trace.
	for (let j = 1; j < length; j++) {
		real[j] = (2 * re[j]) / size
		imag[j] = (-2 * im[j]) / size
	}
	return { real, imag }
}