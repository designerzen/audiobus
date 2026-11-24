import InputMicrophoneEssentia from "./input-microphone-essentia.ts"
import type { FrameFeatureName, FrameFeatures } from "../../analysis/essentia-features.ts"
import { createAudioCommand } from "../../commands/audio-command-factory.ts"
import { CONTROL_CHANGE } from "../../commands/commands.ts"

export const MICROPHONE_TIMBRE_INPUT_ID = "microphone-timbre"

export interface TimbreMapping {
	cc: number
	inputMin: number
	inputMax: number
	outputMin: number
	outputMax: number
	/** Previous-value weight, 0 = immediate, 1 = frozen after first frame. */
	smoothing: number
}

// Input ranges follow typical Essentia output for voice and instruments: centroid is a
// fraction of Nyquist (white noise ≈ 0.5), RMS peaks near 0.2, loudness near 12.
const MAPPINGS: Record<string, TimbreMapping> = {
	brightness: {
		cc: 74,
		inputMin: 0,
		inputMax: 0.5,
		outputMin: 0,
		outputMax: 127,
		smoothing: 0.7
	},
	expression: {
		cc: 11,
		inputMin: 0,
		inputMax: 0.2,
		outputMin: 0,
		outputMax: 127,
		smoothing: 0.7
	},
	flux: { cc: 1, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 127, smoothing: 0.7 }
}
const LOUDNESS_RANGE_MAX = 12

export default class InputMicrophoneTimbre extends InputMicrophoneEssentia {
	readonly features: FrameFeatureName[] = ["spectral"]
	#smoothed = new Map<string, number>()
	#sent = new Map<number, number>()

	get name(): string {
		return MICROPHONE_TIMBRE_INPUT_ID
	}
	get description(): string {
		return "Map microphone tone and dynamics to MIDI CC with Essentia.js (AGPL-3.0)"
	}

	constructor(options: Record<string, any> = {}) {
		const expressionSource = options.expressionSource ?? "rms"
		const defaults = {
			...MAPPINGS,
			expression: {
				...MAPPINGS.expression,
				inputMax:
					expressionSource === "loudness"
						? LOUDNESS_RANGE_MAX
						: MAPPINGS.expression.inputMax
			}
		}
		// rmsGate holds brightness and flux while the signal is too quiet for them to mean anything
		super({
			rmsGate: 0.005,
			...options,
			expressionSource,
			...Object.fromEntries(
				Object.entries(defaults).map(([name, mapping]) => [
					name,
					{ ...mapping, ...options[name] }
				])
			)
		})
	}

	processFrames(frames: FrameFeatures[]): void {
		for (const frame of frames) {
			if (!frame.spectral) {
				continue
			}
			const audible = frame.rms >= this.options.rmsGate
			const values = {
				brightness: frame.spectral.centroid,
				expression:
					this.options.expressionSource === "loudness"
						? frame.spectral.loudness
						: frame.rms,
				flux: frame.spectral.flux
			}
			for (const [name, raw] of Object.entries(values)) {
				const mapping: TimbreMapping = this.options[name]
				if (!Number.isFinite(raw) || !(mapping.inputMax > mapping.inputMin)) {
					continue
				}
				if (!audible && name !== "expression") {
					continue
				}
				const normal = Math.max(
					0,
					Math.min(1, (raw - mapping.inputMin) / (mapping.inputMax - mapping.inputMin))
				)
				const target = mapping.outputMin + normal * (mapping.outputMax - mapping.outputMin)
				const weight = Math.max(0, Math.min(1, mapping.smoothing))
				const smooth = (this.#smoothed.get(name) ?? target) * weight + target * (1 - weight)
				this.#smoothed.set(name, smooth)
				const value = Math.max(0, Math.min(127, Math.round(smooth)))
				if (!Number.isFinite(mapping.cc)) {
					continue
				}
				const cc = Math.max(0, Math.min(127, Math.round(mapping.cc)))
				if (this.#sent.get(cc) === value) {
					continue
				}
				this.#sent.set(cc, value)
				const command = createAudioCommand(CONTROL_CHANGE, cc, this.now, this.name)
				command.value = value
				this.dispatch(command)
			}
		}
	}

	protected resetAnalysis(): void {
		this.#smoothed.clear()
		this.#sent.clear()
	}
}