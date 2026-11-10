export interface SamplerLayer {
	name: string
	start: number
	end: number
	loopStart: number
	loopEnd: number
	loop: boolean
	oneShot: boolean
	root: number
	tune: number
	gain: number
	velocitySensitivity: number
	attack: number
	decay: number
	sustain: number
	release: number
	filter: "lowpass" | "highpass" | "bandpass" | "off"
	cutoff: number
	resonance: number
	velocityLow: number
	fadeIn: number
	fadeOut: number
	velocityHigh: number
	channels?: Float32Array[]
	sampleRate?: number
}
export function createSamplerLayer(): SamplerLayer
export function normaliseSamplerLayer(value: Partial<SamplerLayer>): SamplerLayer
export function samplerVelocityGain(layer: SamplerLayer, velocity: number): number