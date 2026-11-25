/**
 * Single-cycle waveforms drawn from mathematical equations.
 * Each entry renders one period of `size` samples, shaped by two
 * normalized parameters `a` and `b` in [0, 1].
 */
export interface EquationWave {
	title: string
	render: (size: number, a: number, b: number) => Float64Array
}

const TAU = Math.PI * 2

/** Samples f(x) over one period, x ∈ [0, 1) */
function cycle(f: (x: number, a: number, b: number) => number): EquationWave["render"] {
	return (size, a, b) => {
		const points = new Float64Array(size)
		for (let index = 0; index < size; index++) {
			const value = f(index / size, a, b)
			points[index] = Number.isFinite(value) ? value : 0
		}
		return points
	}
}

/** Resamples an arbitrary sequence to exactly one period of `size` samples */
function resample(values: ArrayLike<number>, size: number): Float64Array {
	const points = new Float64Array(size)
	for (let index = 0; index < size; index++) {
		const position = (index * values.length) / size
		const whole = Math.floor(position)
		const fraction = position - whole
		points[index] =
			values[whole] * (1 - fraction) + values[(whole + 1) % values.length] * fraction
	}
	return points
}

/** Sums sin(2πnx)·amplitude(n) for n = 1..count */
function series(count: number, amplitude: (n: number) => number, x: number): number {
	let sum = 0
	for (let n = 1; n <= count; n++) {
		sum += amplitude(n) * Math.sin(TAU * n * x)
	}
	return sum
}

/**
 * Integrates an autonomous ODE and keeps one cycle between two upward
 * zero crossings of the first coordinate after the transient settles.
 */
function limitCycle(
	derivative: (state: number[]) => number[],
	initial: number[],
	dt: number,
	size: number
): Float64Array {
	let state = initial
	const step = () => {
		// Classic fourth-order Runge–Kutta
		const k1 = derivative(state)
		const k2 = derivative(state.map((v, i) => v + (dt / 2) * k1[i]))
		const k3 = derivative(state.map((v, i) => v + (dt / 2) * k2[i]))
		const k4 = derivative(state.map((v, i) => v + dt * k3[i]))
		state = state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
	}
	for (let index = 0; index < 20000; index++) {
		step()
	}
	const trace: number[] = []
	let crossings = 0
	for (let index = 0; index < 200000 && crossings < 2; index++) {
		const previous = state[0]
		step()
		if (previous < 0 && state[0] >= 0) {
			crossings++
		}
		if (crossings === 1) {
			trace.push(state[0])
		}
	}
	return trace.length > 1 ? resample(trace, size) : new Float64Array(size)
}

/** Iterates a map and returns `size` consecutive values after a transient */
function orbit(map: (x: number) => number, seed: number, size: number): Float64Array {
	let x = seed
	for (let index = 0; index < 500; index++) {
		x = map(x)
	}
	const points = new Float64Array(size)
	for (let index = 0; index < size; index++) {
		x = map(x)
		points[index] = x
	}
	return points
}

/** Integer sequence f(k) for k = 1..count, held across the cycle */
function sequence(count: (a: number) => number, f: (k: number) => number): EquationWave["render"] {
	return (size, a) => {
		const length = Math.max(2, Math.round(count(a)))
		return resample(
			Array.from({ length }, (_, index) => f(index + 1)),
			size
		)
	}
}

function bessel(order: number, x: number): number {
	// J_n(x) = (1/π)∫₀^π cos(nτ − x sin τ) dτ
	let sum = 0
	const steps = 64
	for (let index = 0; index < steps; index++) {
		const tau = ((index + 0.5) * Math.PI) / steps
		sum += Math.cos(order * tau - x * Math.sin(tau))
	}
	return sum / steps
}

function airy(x: number): number {
	// Ai(x) = (1/π)∫₀^∞ cos(t³/3 + xt) dt, truncated with a soft window
	let sum = 0
	const steps = 400
	const limit = 8
	for (let index = 0; index < steps; index++) {
		const t = ((index + 0.5) * limit) / steps
		sum += Math.cos(t ** 3 / 3 + x * t) * Math.exp(-((t / limit) ** 4) * 4)
	}
	return (sum * limit) / steps / Math.PI
}

function legendre(order: number, x: number): number {
	let previous = 1
	let current = x
	if (order === 0) {
		return previous
	}
	for (let n = 1; n < order; n++) {
		;[previous, current] = [current, ((2 * n + 1) * x * current - n * previous) / (n + 1)]
	}
	return current
}

function hermiteFunction(order: number, x: number): number {
	let previous = 1
	let current = 2 * x
	if (order === 0) {
		current = 1
	}
	for (let n = 1; n < order; n++) {
		;[previous, current] = [current, 2 * x * current - 2 * n * previous]
	}
	return (current * Math.exp((-x * x) / 2)) / Math.sqrt(2 ** order * Math.exp(lgamma(order + 1)))
}

function lgamma(x: number): number {
	let sum = 0
	for (let k = 2; k < x; k++) {
		sum += Math.log(k)
	}
	return sum
}

function erf(x: number): number {
	// Abramowitz–Stegun 7.1.26
	const t = 1 / (1 + 0.3275911 * Math.abs(x))
	const y =
		1 -
		((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
			0.254829592) *
			t *
			Math.exp(-x * x)
	return Math.sign(x) * y
}

function fresnel(x: number): [number, number] {
	// C(x), S(x) by midpoint integration of cos/sin(πt²/2)
	let c = 0
	let s = 0
	const steps = 200
	for (let index = 0; index < steps; index++) {
		const t = ((index + 0.5) * x) / steps
		c += Math.cos((Math.PI * t * t) / 2)
		s += Math.sin((Math.PI * t * t) / 2)
	}
	return [(c * x) / steps, (s * x) / steps]
}

/** Jacobi elliptic sn(u, k) via the arithmetic–geometric mean */
function jacobiSn(u: number, k: number): number {
	const a = [1]
	const c = [k]
	let b = Math.sqrt(1 - k * k)
	let n = 0
	while (Math.abs(c[n]) > 1e-12 && n < 16) {
		a.push((a[n] + b) / 2)
		c.push((a[n] - b) / 2)
		b = Math.sqrt(a[n] * b)
		n++
	}
	let phi = 2 ** n * a[n] * u
	for (; n > 0; n--) {
		phi = (phi + Math.asin((c[n] / a[n]) * Math.sin(phi))) / 2
	}
	return Math.sin(phi)
}

/** Complete elliptic integral K(k), so sn has period 4K */
function ellipticK(k: number): number {
	let a = 1
	let b = Math.sqrt(1 - k * k)
	for (let index = 0; index < 16; index++) {
		;[a, b] = [(a + b) / 2, Math.sqrt(a * b)]
	}
	return Math.PI / (2 * a)
}

function isPrime(n: number): boolean {
	if (n < 2) {
		return false
	}
	for (let d = 2; d * d <= n; d++) {
		if (n % d === 0) {
			return false
		}
	}
	return true
}

function mobius(n: number): number {
	let result = 1
	for (let d = 2; d * d <= n; d++) {
		if (n % d === 0) {
			n /= d
			if (n % d === 0) {
				return 0
			}
			result = -result
		}
	}
	return n > 1 ? -result : result
}

function totient(n: number): number {
	let result = n
	for (let d = 2; d * d <= n; d++) {
		if (n % d === 0) {
			while (n % d === 0) {
				n /= d
			}
			result -= result / d
		}
	}
	return n > 1 ? result - result / n : result
}

function popcount(n: number): number {
	let count = 0
	for (; n; n &= n - 1) {
		count++
	}
	return count
}

function collatzSteps(n: number): number {
	let steps = 0
	for (; n !== 1 && steps < 1000; steps++) {
		n = n % 2 ? 3 * n + 1 : n / 2
	}
	return steps
}

function stern(n: number): number {
	// Stern's diatomic sequence
	let a = 1
	let b = 0
	for (; n > 0; n >>= 1) {
		if (n & 1) {
			b += a
		} else {
			a += b
		}
	}
	return b
}

function cantor(x: number, depth = 12): number {
	let result = 0
	let scale = 0.5
	for (let index = 0; index < depth; index++) {
		x *= 3
		const digit = Math.floor(x)
		x -= digit
		if (digit === 1) {
			return result + scale
		}
		result += (digit / 2) * scale
		scale /= 2
	}
	return result
}

const triangle = (x: number) => 1 - 4 * Math.abs(x - Math.round(x - 0.25) - 0.25)

export const EQUATION_WAVES: EquationWave[] = [
	// Fourier series and kernels
	{
		title: "Fourier sawtooth Σ sin(nx)/n",
		render: cycle((x, a) => series(1 + Math.round(a * 63), (n) => 1 / n, x))
	},
	{
		title: "Gibbs square Σ sin((2n−1)x)/(2n−1)",
		render: cycle((x, a) => series(1 + Math.round(a * 63), (n) => (n % 2 ? 1 / n : 0), x))
	},
	{
		title: "Dirichlet kernel sin((N+½)x)/sin(x/2)",
		render: cycle((x, a) => {
			const order = 1 + Math.round(a * 31)
			const s = Math.sin(Math.PI * x)
			return Math.abs(s) < 1e-9 ? 2 * order + 1 : Math.sin((order + 0.5) * TAU * x) / s
		})
	},
	{
		title: "Fejér kernel (sin(Nx/2)/sin(x/2))²/N",
		render: cycle((x, a) => {
			const order = 2 + Math.round(a * 30)
			const s = Math.sin(Math.PI * x)
			return Math.abs(s) < 1e-9 ? order : Math.sin(order * Math.PI * x) ** 2 / s ** 2 / order
		})
	},
	{
		title: "Clausen function Σ sin(nx)/n²",
		render: cycle((x) => series(256, (n) => 1 / (n * n), x))
	},
	{
		title: "Weierstrass Σ aⁿ cos(bⁿπx)",
		render: cycle((x, a, b) => {
			const decay = 0.3 + a * 0.6
			const base = 2 + Math.round(b * 7)
			let sum = 0
			for (
				let n = 0, scale = 1, frequency = 1;
				n < 12;
				n++, scale *= decay, frequency *= base
			) {
				sum += scale * Math.cos(TAU * frequency * x)
			}
			return sum
		})
	},
	{
		title: "Takagi blancmange Σ s(2ⁿx)/2ⁿ",
		render: cycle((x, a) => {
			const decay = 0.3 + a * 0.6
			let sum = 0
			for (let n = 0, scale = 1, frequency = 1; n < 16; n++, scale *= decay, frequency *= 2) {
				const y = frequency * x
				sum += scale * Math.abs(y - Math.round(y))
			}
			return sum
		})
	},
	{
		title: "Riemann's function Σ sin(n²x)/n²",
		render: cycle(riemann)
	},
	// Modulation and waveshaping
	{
		title: "Jacobi–Anger FM sin(x + β sin(mx))",
		render: cycle((x, a, b) =>
			Math.sin(TAU * x + a * 8 * Math.sin(TAU * (1 + Math.round(b * 7)) * x))
		)
	},
	{
		title: "Chebyshev Tₙ(cos x)",
		render: cycle((x, a, b) => {
			const c = Math.cos(TAU * x) * (0.2 + 0.8 * b)
			return Math.cos((1 + Math.round(a * 15)) * Math.acos(c))
		})
	},
	{
		title: "Chebyshev blend Σ Tₙ(sin x)/n",
		render: cycle((x, a) => {
			const s = Math.sin(TAU * x)
			let sum = 0
			const count = 1 + Math.round(a * 11)
			for (let n = 1; n <= count; n++) {
				sum += Math.cos(n * Math.acos(s)) / n
			}
			return sum
		})
	},
	{
		title: "Hyperbolic tangent tanh(k sin x)",
		render: cycle((x, a) => Math.tanh((0.5 + a * 30) * Math.sin(TAU * x)))
	},
	{
		title: "Error function erf(k sin x)",
		render: cycle((x, a) => erf((0.5 + a * 10) * Math.sin(TAU * x)))
	},
	{
		title: "Wavefolder sin(k sin x)",
		render: cycle((x, a) => Math.sin((1 + a * 12) * Math.sin(TAU * x)))
	},
	{
		title: "Phase distortion sin(2π·xᵏ)",
		render: cycle((x, a) => Math.sin(TAU * x ** (0.2 + a * 4)))
	},
	{
		title: "Sinc pulse sin(kx)/kx",
		render: cycle((x, a) => {
			const t = (x - 0.5) * (4 + a * 60)
			return t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)
		})
	},
	{
		title: "Gaussian pulse e^(−x²/σ²)",
		render: cycle((x, a) => Math.exp(-(((x - 0.5) / (0.01 + a * 0.3)) ** 2)))
	},
	{
		title: "Superellipse |sin|ⁿ sgn(sin)",
		render: cycle((x, a) => {
			const s = Math.sin(TAU * x)
			return Math.sign(s) * Math.abs(s) ** (0.05 + a * 4)
		})
	},
	// Special functions
	{
		title: "Bessel Jₙ(kx)",
		render: cycle((x, a, b) => bessel(Math.round(b * 5), (x - 0.5) * (5 + a * 40)))
	},
	{
		title: "Airy Ai(x)",
		render: cycle((x, a) => airy((x - 0.7) * (5 + a * 25)))
	},
	{
		title: "Legendre Pₙ(cos x)",
		render: cycle((x, a) => legendre(1 + Math.round(a * 15), Math.cos(TAU * x)))
	},
	{
		title: "Hermite function ψₙ(x)",
		render: cycle((x, a) => hermiteFunction(Math.round(a * 12), (x - 0.5) * 12))
	},
	{
		title: "Fresnel / Cornu spiral C(x)",
		render: cycle((x, a) => fresnel((x - 0.5) * (2 + a * 8))[0])
	},
	{
		title: "Jacobi elliptic sn(u, k)",
		render: cycle((x, a) => {
			const k = Math.min(0.999999, a)
			return jacobiSn(x * 4 * ellipticK(k), k)
		})
	},
	{
		title: "Gamma 1/Γ(x)",
		render: cycle((x, a) => {
			const t = (x - 0.5) * (4 + a * 8)
			return reciprocalGamma(t)
		})
	},
	// Curves and geometry
	{
		title: "Rose r = cos(kθ), x-projection",
		render: cycle((x, a) => {
			const theta = TAU * x
			return Math.cos((1 + Math.round(a * 8)) * theta) * Math.cos(theta)
		})
	},
	{
		title: "Hypotrochoid (spirograph)",
		render: cycle((x, a, b) => {
			const ratio = 2 + Math.round(a * 9)
			const theta = TAU * x
			return (ratio - 1) * Math.cos(theta) + (0.2 + b * 2) * Math.cos((ratio - 1) * theta)
		})
	},
	{
		title: "Epicycloid",
		render: cycle((x, a) => {
			const k = 1 + Math.round(a * 9)
			const theta = TAU * x
			return (k + 1) * Math.cos(theta) - Math.cos((k + 1) * theta)
		})
	},
	{
		title: "Gielis superformula",
		render: cycle((x, a, b) => {
			const m = Math.round(a * 12)
			const n = 0.2 + b * 6
			const theta = TAU * x
			const r =
				(Math.abs(Math.cos((m * theta) / 4)) ** n +
					Math.abs(Math.sin((m * theta) / 4)) ** n) **
				(-1 / n)
			return r * Math.cos(theta)
		})
	},
	{
		title: "Lemniscate of Bernoulli",
		render: cycle((x) => {
			const t = TAU * x
			return (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)
		})
	},
	{
		title: "Cycloid",
		render: cycle((x, a) => {
			// Solve t − k sin t = 2πx for the cycloid height 1 − cos t
			const k = Math.min(0.999, a)
			let t = TAU * x
			for (let index = 0; index < 12; index++) {
				t -= (t - k * Math.sin(t) - TAU * x) / (1 - k * Math.cos(t))
			}
			return 1 - Math.cos(t)
		})
	},
	{
		title: "Kepler orbit r(M), eccentricity e",
		render: cycle((x, a) => {
			const e = Math.min(0.97, a)
			let anomaly = TAU * x
			for (let index = 0; index < 16; index++) {
				anomaly -= (anomaly - e * Math.sin(anomaly) - TAU * x) / (1 - e * Math.cos(anomaly))
			}
			return Math.cos(anomaly) - e
		})
	},
	{
		title: "Catenary cosh(x)",
		render: cycle((x, a) => Math.cosh((x - 0.5) * (1 + a * 8)))
	},
	{
		title: "Logarithmic spiral",
		render: cycle((x, a) => Math.exp((0.05 + a * 0.6) * TAU * x) * Math.cos(TAU * 3 * x))
	},
	// Fractals
	{
		title: "Cantor devil's staircase",
		render: cycle((x) => cantor(x) - x)
	},
	{
		title: "Koch-like triangle iterate",
		render: cycle((x, a) => {
			let sum = 0
			for (
				let n = 0, scale = 1, frequency = 1;
				n < 10;
				n++, scale *= 0.25 + a * 0.5, frequency *= 3
			) {
				sum += scale * triangle(frequency * x)
			}
			return sum
		})
	},
	{
		title: "Mandelbrot orbit Re(z), c on cardioid",
		render: (size, a, b) => {
			// Just outside the main cardioid, so the orbit wanders before escaping
			const angle = TAU * (0.05 + a * 0.9)
			const scale = 1.02 + b * 0.1
			const cr = scale * (0.5 * Math.cos(angle) - 0.25 * Math.cos(2 * angle))
			const ci = scale * (0.5 * Math.sin(angle) - 0.25 * Math.sin(2 * angle))
			let zr = 0
			let zi = 0
			const values: number[] = []
			for (let index = 0; index < 2000; index++) {
				;[zr, zi] = [zr * zr - zi * zi + cr, 2 * zr * zi + ci]
				if (zr * zr + zi * zi > 4) {
					zr = 0
					zi = 0
				}
				if (index >= 1000) {
					values.push(zr)
				}
			}
			return resample(values.slice(0, 64), size)
		}
	},
	// Chaos and dynamical systems
	{
		title: "Logistic map xₙ₊₁ = r xₙ(1 − xₙ)",
		render: (size, a) => {
			const r = 3.4 + a * 0.6
			return resample(
				orbit((x) => r * x * (1 - x), 0.4, 64),
				size
			)
		}
	},
	{
		title: "Tent map",
		render: (size, a) => {
			const mu = 1.2 + a * 0.79
			return resample(
				orbit((x) => mu * Math.min(x, 1 - x), 0.31, 64),
				size
			)
		}
	},
	{
		title: "Circle map (Arnold tongues)",
		render: (size, a, b) => {
			const omega = 0.2 + a * 0.6
			const k = b * 0.95
			return resample(
				orbit((x) => (x + omega - (k / TAU) * Math.sin(TAU * x)) % 1, 0.1, 64).map((x) =>
					Math.cos(TAU * x)
				),
				size
			)
		}
	},
	{
		title: "Van der Pol limit cycle",
		render: (size, a) => {
			const mu = 0.1 + a * 8
			return limitCycle(([x, y]) => [y, mu * (1 - x * x) * y - x], [0.5, 0], 0.01, size)
		}
	},
	{
		title: "Lorenz attractor x(t)",
		render: (size, a) => {
			const rho = 24 + a * 30
			const values = orbitOde(
				([x, y, z]) => [10 * (y - x), x * (rho - z) - y, x * y - (8 / 3) * z],
				[1, 1, 1],
				0.005,
				3000
			)
			return resample(values, size)
		}
	},
	{
		title: "Rössler attractor x(t)",
		render: (size, a) => {
			const c = 3 + a * 10
			return limitCycle(
				([x, y, z]) => [-y - z, x + 0.2 * y, 0.2 + z * (x - c)],
				[1, 1, 0],
				0.01,
				size
			)
		}
	},
	{
		title: "Duffing oscillator x″ + δx′ − x + x³ = γ cos ωt",
		render: (size, a, b) => {
			const gamma = 0.2 + a * 0.4
			const delta = 0.1 + b * 0.3
			let x = 1
			let v = 0
			const steps = 512
			const dt = TAU / steps
			const trace = new Float64Array(steps)
			for (let period = 0; period < 40; period++) {
				for (let index = 0; index < steps; index++) {
					const t = index * dt
					const acceleration = -delta * v + x - x ** 3 + gamma * Math.cos(t)
					v += acceleration * dt
					x += v * dt
					trace[index] = x
				}
			}
			return resample(trace, size)
		}
	},
	{
		title: "Nonlinear pendulum θ″ = −sin θ",
		render: (size, a) => {
			const amplitude = 0.1 + a * 3.0
			return limitCycle(
				([theta, omega]) => [omega, -Math.sin(theta)],
				[0, 2 * Math.sin(amplitude / 2)],
				0.005,
				size
			)
		}
	},
	{
		title: "Lotka–Volterra predator–prey",
		render: (size, a) =>
			// Shifted so the prey population crosses zero at its equilibrium
			limitCycle(
				([prey, predator]) => [(prey + 1) * (1 - predator), predator * prey],
				[0.5 + a * 2, 1],
				0.002,
				size
			)
	},
	// Number theory
	{
		title: "Prime indicator",
		render: sequence(
			(a) => 16 + a * 240,
			(k) => (isPrime(k) ? 1 : 0)
		)
	},
	{
		title: "Möbius μ(n)",
		render: sequence((a) => 16 + a * 240, mobius)
	},
	{
		title: "Euler totient φ(n)/n",
		render: sequence(
			(a) => 16 + a * 240,
			(k) => totient(k) / k
		)
	},
	{
		title: "Thue–Morse parity",
		render: sequence(
			(a) => 16 + a * 496,
			(k) => popcount(k - 1) % 2
		)
	},
	{
		title: "Rudin–Shapiro sequence",
		render: sequence(
			(a) => 16 + a * 496,
			(k) => {
				let pairs = 0
				for (let n = k - 1; n; n >>= 1) {
					if ((n & 3) === 3) {
						pairs++
					}
				}
				return pairs % 2 ? -1 : 1
			}
		)
	},
	{
		title: "Collatz stopping times",
		render: sequence((a) => 16 + a * 240, collatzSteps)
	},
	{
		title: "Stern's diatomic sequence",
		render: sequence((a) => 16 + a * 496, stern)
	},
	{
		title: "Fibonacci word",
		render: sequence(
			(a) => 16 + a * 496,
			(k) => Math.floor((k + 1) / PHI) - Math.floor(k / PHI) - (PHI - 1)
		)
	},
	{
		title: "Golden-ratio quasicrystal Σ cos(φⁿx)",
		render: cycle((x, a) => {
			let sum = 0
			const count = 2 + Math.round(a * 6)
			for (let n = 0; n < count; n++) {
				sum += Math.cos(TAU * Math.round(PHI ** n) * x)
			}
			return sum
		})
	},
	{
		title: "Digits of π",
		render: sequence(
			(a) => 16 + a * 48,
			(k) => Number(PI_DIGITS[(k - 1) % PI_DIGITS.length]) - 4.5
		)
	},
	// Probability and physics
	{
		title: "Planck spectrum x³/(eˣ − 1)",
		render: cycle((x, a) =>
			series(
				128,
				(n) => {
					const t = n / (2 + a * 30)
					return t ** 3 / (Math.exp(t) - 1)
				},
				x
			)
		)
	},
	{
		title: "Poisson spectrum λⁿe^(−λ)/n!",
		render: cycle((x, a) => {
			const lambda = 1 + a * 20
			return series(64, (n) => Math.exp(n * Math.log(lambda) - lambda - lgamma(n + 1)), x)
		})
	},
	{
		title: "Harmonic damping e^(−kn)",
		render: cycle((x, a) => series(128, (n) => Math.exp(-(0.02 + a) * n), x))
	},
	{
		title: "Quantum well Σ ψₙ (particle in a box)",
		render: cycle((x, a) => {
			// Superposed eigenstates with energies ∝ n² sampled at time a
			let sum = 0
			for (let n = 1; n <= 4; n++) {
				sum += Math.sin(n * Math.PI * x) * Math.cos(n * n * a * TAU)
			}
			return sum
		})
	}
]

const PHI = (1 + Math.sqrt(5)) / 2
const PI_DIGITS = "3141592653589793238462643383279502884197169399375105820974944592307816406286"

function riemann(x: number): number {
	let sum = 0
	for (let n = 1; n <= 64; n++) {
		sum += Math.sin(TAU * n * n * x) / (n * n)
	}
	return sum
}

function reciprocalGamma(t: number): number {
	// 1/Γ(t) via Lanczos, with Γ(t)Γ(1 − t) = π/sin(πt) below ½
	const g = 7
	const c = [
		0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
		-176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
		1.5056327351493116e-7
	]
	if (t < 0.5) {
		return Math.sin(Math.PI * t) / (Math.PI * reciprocalGamma(1 - t))
	}
	t -= 1
	let x = c[0]
	for (let i = 1; i < g + 2; i++) {
		x += c[i] / (t + i)
	}
	const w = t + g + 0.5
	return 1 / (Math.sqrt(TAU) * w ** (t + 0.5) * Math.exp(-w) * x)
}

function orbitOde(
	derivative: (state: number[]) => number[],
	initial: number[],
	dt: number,
	count: number
): number[] {
	let state = initial
	const values: number[] = []
	for (let index = 0; index < 2000 + count; index++) {
		const k = derivative(state)
		state = state.map((v, i) => v + dt * k[i])
		if (index >= 2000) {
			values.push(state[0])
		}
	}
	return values
}