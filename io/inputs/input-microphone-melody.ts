import InputMicrophoneEssentia from "./input-microphone-essentia.ts"
import type { FrameFeatureName, FrameFeatures } from "../../analysis/essentia-features.ts"
import { createAudioCommand } from "../../commands/audio-command-factory.ts"
import { NOTE_ON, NOTE_OFF, PITCH_BEND } from "../../commands/commands.ts"

export const MICROPHONE_MELODY_INPUT_ID = "microphone-melody"

export default class InputMicrophoneMelody extends InputMicrophoneEssentia {
	readonly features: FrameFeatureName[] = ["pitch"]
	#held?: number
	#candidate?: number
	#stable = 0
	#quiet = 0
	#bend = 8192

	get name(): string {
		return MICROPHONE_MELODY_INPUT_ID
	}
	get description(): string {
		return "Hum or play one note with Essentia.js (AGPL-3.0)"
	}

	constructor(options: Record<string, any> = {}) {
		super({
			rmsGate: 0.01,
			confidenceThreshold: 0.8,
			stableFrames: 2,
			releaseFrames: 4,
			pitchBendRange: 2,
			velocity: 100,
			pitchMinFrequency: 65,
			pitchMaxFrequency: 1500,
			frameSize: 2048,
			hopSize: 512,
			...options
		})
	}

	/** Also accepts synthetic frames without starting microphone capture. */
	processFrames(frames: FrameFeatures[]): void {
		for (const frame of frames) {
			const pitch = frame.pitch
			const midi = pitch ? 69 + 12 * Math.log2(pitch.frequency / 440) : NaN
			if (
				!(frame.rms >= this.options.rmsGate) ||
				!pitch ||
				!(pitch.confidence >= this.options.confidenceThreshold) ||
				!(midi >= -0.5 && midi <= 127.5)
			) {
				this.#candidate = undefined
				this.#stable = 0
				if (++this.#quiet >= this.options.releaseFrames) {
					this.#release()
				}
				continue
			}
			this.#quiet = 0
			if (this.#held !== undefined && Math.abs(midi - this.#held) <= 0.5) {
				this.#candidate = undefined
				this.#stable = 0
				this.#sendBend(midi - this.#held)
				continue
			}
			const note = Math.max(0, Math.min(127, Math.round(midi)))
			if (this.#candidate === note) {
				this.#stable++
			} else {
				this.#candidate = note
				this.#stable = 1
			}
			if (this.#stable < this.options.stableFrames) {
				continue
			}
			this.#release()
			this.#held = note
			const command = createAudioCommand(NOTE_ON, note, this.now, this.name)
			command.velocity = Math.max(1, Math.min(127, Math.round(this.options.velocity)))
			this.dispatch(command)
			this.#sendBend(midi - note)
		}
	}

	#sendBend(semitones: number): void {
		const value = Math.max(
			0,
			Math.min(
				16383,
				Math.round(8192 + (semitones / Math.max(0.01, this.options.pitchBendRange)) * 8192)
			)
		)
		if (value === this.#bend) {
			return
		}
		this.#bend = value
		const command = createAudioCommand(PITCH_BEND, this.#held ?? 0, this.now, this.name)
		command.value = value
		this.dispatch(command)
	}

	#release(): void {
		if (this.#held !== undefined) {
			this.dispatch(createAudioCommand(NOTE_OFF, this.#held, this.now, this.name))
			this.#sendBend(0)
		}
		this.#held = undefined
	}

	protected resetAnalysis(): void {
		this.#release()
		this.#candidate = undefined
		this.#stable = this.#quiet = 0
	}
}