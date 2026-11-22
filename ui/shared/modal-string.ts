/**
 * Damped modal string simulator shared by plucked, strummed and harmonic-wave controllers.
 * Each string stores cosine (a) and sine (b) amplitudes for modes n = 1..modes in CSS pixels.
 */
export interface ModalString {
	note: number
	modes: number
	/** Modal displacement in CSS pixels. */
	a: Float32Array
	/** Modal velocity divided by its angular frequency, in CSS pixels. */
	b: Float32Array
	/** Visible fundamental angular frequency in radians per second; lower notes swing slower. */
	omega: number
	/** Audible envelope level, 0–1. */
	level: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function modalFundamentalOmega(note: number): number {
	return 2 * Math.PI * clamp(3.5 * 2 ** ((note - 40) / 24), 2, 9)
}

export function createModalString(note: number, modes = 5): ModalString {
	const count = Math.max(1, Math.round(modes))
	return {
		note,
		modes: count,
		a: new Float32Array(count),
		b: new Float32Array(count),
		omega: modalFundamentalOmega(note),
		level: 0
	}
}

/** Set a string to the triangle a finger makes holding it at position (0–1), displaced by offset. */
export function shapeModalString(string: ModalString, position: number, offset: number): void {
	const u = clamp(position, 0.04, 0.96)
	const scale = (2 * offset) / (Math.PI * Math.PI * u * (1 - u))
	for (let m = 0; m < string.modes; m++) {
		const n = m + 1
		string.a[m] = (scale * Math.sin(n * Math.PI * u)) / (n * n)
		string.b[m] = 0
	}
}

/** Add a velocity impulse at position (0–1) to set the string swinging gently. */
export function nudgeModalString(string: ModalString, position: number, impulse: number): void {
	const u = clamp(position, 0.04, 0.96)
	for (let m = 0; m < string.modes; m++) {
		const n = m + 1
		string.b[m] += (impulse * Math.sin(n * Math.PI * u)) / n
	}
}

/** Excite a single standing-wave harmonic mode (1-indexed: 1 = fundamental, 2 = octave, etc.). */
export function exciteModalHarmonic(
	string: ModalString,
	harmonic: number,
	amplitude: number,
	velocity = 0
): void {
	const index = harmonic - 1
	if (index < 0 || index >= string.modes) {
		return
	}
	string.a[index] = amplitude
	string.b[index] = velocity
}

/**
 * Sustain and smoothly drive a single standing-wave harmonic mode while held or bowed.
 * Rotates the mode at its natural harmonic frequency while pulling its envelope toward target.
 */
export function driveModalHarmonic(
	string: ModalString,
	harmonic: number,
	targetAmplitude: number,
	seconds: number,
	attackRate = 12
): void {
	const index = harmonic - 1
	if (index < 0 || index >= string.modes) {
		return
	}
	const angle = string.omega * harmonic * seconds
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)
	const a = string.a[index]
	const b = string.b[index]
	const nextA = a * cos + b * sin
	const nextB = b * cos - a * sin
	const radius = Math.hypot(nextA, nextB)
	const blend = 1 - Math.exp(-attackRate * seconds)
	const nextRadius = radius + (Math.max(0, targetAmplitude) - radius) * blend
	if (radius > 1e-4) {
		const scale = nextRadius / radius
		string.a[index] = nextA * scale
		string.b[index] = nextB * scale
	} else {
		string.a[index] = nextRadius
		string.b[index] = 0
	}
}

/** Advance every mode by seconds using exact rotation and exponential decay. */
export function stepModalString(
	string: ModalString,
	seconds: number,
	damping: number,
	skipMode = -1
): void {
	for (let m = 0; m < string.modes; m++) {
		if (m === skipMode) {
			continue
		}
		const n = m + 1
		const angle = string.omega * n * seconds
		const decay = Math.exp(-damping * (0.5 + 0.5 * n) * seconds)
		const cos = Math.cos(angle)
		const sin = Math.sin(angle)
		const a = string.a[m]
		const b = string.b[m]
		string.a[m] = (a * cos + b * sin) * decay
		string.b[m] = (b * cos - a * sin) * decay
	}
}

/** Evaluate perpendicular displacement in CSS pixels at normalized position u in [0, 1]. */
export function sampleModalString(string: ModalString, u: number): number {
	let offset = 0
	for (let m = 0; m < string.modes; m++) {
		offset += string.a[m] * Math.sin((m + 1) * Math.PI * u)
	}
	return offset
}

/** Total modal displacement + velocity energy, used to sleep the animation loop when still. */
export function modalStringAmplitude(string: ModalString): number {
	let sum = 0
	for (let m = 0; m < string.modes; m++) {
		sum += Math.abs(string.a[m]) + Math.abs(string.b[m])
	}
	return sum
}

/** Zero all modal motion and level. */
export function clearModalString(string: ModalString): void {
	string.a.fill(0)
	string.b.fill(0)
	string.level = 0
}