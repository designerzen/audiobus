import type { HihatOptions, ShakerOptions } from "./percussion-presets.ts"
import { generateRoomImpulse } from "../../effects/room-impulse.ts"
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export const renderCymbal = (context: AudioContext, options: HihatOptions, variant: number) => {
	const sampleRate = context.sampleRate
	const length = Math.ceil(options.length * sampleRate)
	const buffer = context.createBuffer(1, length, sampleRate)
	const data = buffer.getChannelData(0)
	const ratios = options.ratios
	const modeCount = ratios.length * 4
	const metallicLevel = (1.35 * options.metallicGain) / Math.sqrt(modeCount)
	const families = options.type === "sine" ? [2.3, 5.1, 11.27, 19.43] : [5.1, 11.27, 19.43, 31.87]
	for (let mode = 0; mode < modeCount; mode++) {
		const family = Math.floor(mode / ratios.length)
		const frequency =
			options.fundamental *
			ratios[mode % ratios.length] *
			families[family] *
			(1 + (variant ? 1 : -1) * 0.0015 * (mode % 3))
		if (frequency >= sampleRate * 0.45) {
			continue
		}
		const angle = (2 * Math.PI * frequency) / sampleRate
		const decay = Math.exp(-(3.5 + family * 2.1) / length)
		const coefficient = 2 * decay * Math.cos(angle)
		const squaredDecay = decay * decay
		const phase = mode * 1.618 + variant * 0.73
		let previous = Math.sin(phase - angle) / decay
		let current = Math.sin(phase)
		const level = metallicLevel * (options.type === "triangle" ? 1 / (1 + family * 0.35) : 1)
		for (let sample = 0; sample < length; sample++) {
			data[sample] += current * level
			const next = coefficient * current - squaredDecay * previous
			previous = current
			current = next
		}
	}
	// A little diffuse excitation fills the spaces between the ringing modes.
	let seed = (0x12345678 + variant * 7919) >>> 0
	const noiseDecay = Math.exp(-5 / length)
	let noiseLevel = Math.max(options.noiseGain, options.metallicGain * 0.025)
	const noiseHighpass =
		1 -
		Math.exp((-2 * Math.PI * clamp(options.noiseHighpass, 20, sampleRate * 0.45)) / sampleRate)
	const noiseLowpass =
		1 -
		Math.exp((-2 * Math.PI * clamp(options.noiseLowpass, 20, sampleRate * 0.45)) / sampleRate)
	let low = 0,
		high = 0
	let noiseTail = 1
	const noiseTailDecay = Math.exp(-1 / Math.max(1, options.noiseDecay * sampleRate))
	const noiseAttackSamples = Math.max(1, options.noiseAttack * sampleRate)
	const taper = Math.min(Math.floor(length / 2), Math.ceil(sampleRate * 0.002))
	let peak = 0
	for (let sample = 0; sample < length; sample++) {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		const noise = seed / 2147483648 - 1
		low += noiseHighpass * (noise - low)
		high += noiseLowpass * (noise - low - high)
		const noiseAttack = Math.min(1, sample / noiseAttackSamples)
		data[sample] += high * noiseLevel * noiseAttack * (0.4 + 0.6 * noiseTail)
		noiseTail *= noiseTailDecay
		noiseLevel *= noiseDecay
		data[sample] *= Math.min(1, sample / taper, (length - 1 - sample) / taper)
		peak = Math.max(peak, Math.abs(data[sample]))
	}
	if (peak > 0.9) {
		for (let sample = 0; sample < length; sample++) {
			data[sample] *= 0.9 / peak
		}
	}
	return buffer
}

const getStrokeLevel = (phase: number, attackRatio: number, releaseRatio: number) => {
	if (phase <= attackRatio) {
		return (phase / attackRatio) ** 1.5
	}
	if (phase >= releaseRatio) {
		return ((1 - phase) / (1 - releaseRatio)) ** 1.7
	}
	const travel = (phase - attackRatio) / Math.max(0.001, releaseRatio - attackRatio)
	return 1 - travel * 0.22
}

const normalizeBuffer = (data: Float32Array) => {
	let peak = 0
	for (const sample of data) {
		peak = Math.max(peak, Math.abs(sample))
	}
	if (peak <= 0) {
		return
	}
	const scale = 0.72 / peak
	for (let index = 0; index < data.length; index++) {
		data[index] *= scale
	}
}

export const createParticleBufferPair = (
	audioContext: AudioContext,
	options: ShakerOptions,
	density: number,
	random = Math.random
) => {
	const sampleRate = audioContext.sampleRate
	const duration = Math.max(0.02, Number(options.length) || 0.13)
	const sampleCount = Math.max(2, Math.ceil(duration * sampleRate))
	const fineBuffer = audioContext.createBuffer(1, sampleCount, sampleRate)
	const coarseBuffer = audioContext.createBuffer(1, sampleCount, sampleRate)
	const fineData = fineBuffer.getChannelData(0)
	const coarseData = coarseBuffer.getChannelData(0)
	const attackRatio = clamp((Number(options.attack) || 0.012) / duration, 0.025, 0.35)
	const releaseRatio = clamp(
		1 - (Number(options.release) || 0.045) / duration,
		attackRatio + 0.08,
		0.94
	)
	const collisionCount = Math.max(5, Math.round((8 + duration * 70) * (0.45 + density * 0.75)))
	const fineDecay = clamp((Number(options.decay) || 0.05) * 0.05, 0.0018, 0.006)
	const coarseDecay = clamp((Number(options.decay) || 0.05) * 0.12, 0.004, 0.012)

	for (let collision = 0; collision < collisionCount; collision++) {
		let phase = 0.5
		let strokeLevel = 1
		for (let attempt = 0; attempt < 16; attempt++) {
			phase = 0.015 + random() * 0.97
			strokeLevel = getStrokeLevel(phase, attackRatio, releaseRatio)
			if (random() <= strokeLevel) {
				break
			}
		}

		const start = Math.floor(phase * (sampleCount - 1))
		const strength = (0.32 + random() * 0.68) * strokeLevel
		const fineAttack = Math.max(1, Math.round(sampleRate * (0.0002 + random() * 0.00055)))
		const coarseAttack = Math.max(1, Math.round(sampleRate * (0.0004 + random() * 0.0007)))
		const fineLength = Math.max(
			fineAttack + 1,
			Math.round(sampleRate * fineDecay * (0.75 + random() * 0.5))
		)
		const coarseLength = Math.max(
			coarseAttack + 1,
			Math.round(sampleRate * coarseDecay * (0.75 + random() * 0.5))
		)
		const coarseHold = 3 + Math.floor(random() * 6)
		let coarseNoise = random() * 2 - 1

		for (
			let offset = 0;
			offset < Math.max(fineLength, coarseLength) && start + offset < sampleCount;
			offset++
		) {
			if (offset < fineLength) {
				const envelope =
					offset < fineAttack
						? offset / fineAttack
						: Math.exp(
								(-5 * (offset - fineAttack)) / Math.max(1, fineLength - fineAttack)
							)
				fineData[start + offset] += (random() * 2 - 1) * strength * envelope
			}
			if (offset < coarseLength) {
				if (offset % coarseHold === 0) {
					coarseNoise = random() * 2 - 1
				}
				const envelope =
					offset < coarseAttack
						? offset / coarseAttack
						: Math.exp(
								(-4.2 * (offset - coarseAttack)) /
									Math.max(1, coarseLength - coarseAttack)
							)
				coarseData[start + offset] += coarseNoise * strength * envelope
			}
		}
	}

	const taperSamples = Math.min(
		Math.floor(sampleCount / 4),
		Math.max(2, Math.round(sampleRate * 0.006))
	)
	for (let offset = 0; offset < taperSamples; offset++) {
		const level = offset / taperSamples
		fineData[offset] *= level
		coarseData[offset] *= level
		const endIndex = sampleCount - 1 - offset
		fineData[endIndex] *= level
		coarseData[endIndex] *= level
	}
	normalizeBuffer(fineData)
	normalizeBuffer(coarseData)
	return { fineBuffer, coarseBuffer }
}

/** The short, bright room the triangle voices ring into. */
export const generateTriangleImpulse = (context: AudioContext) =>
	generateRoomImpulse(context, { length: 0.18, tone: 0.6, preDelay: 0 })