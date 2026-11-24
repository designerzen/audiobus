import InputMicrophoneEssentia from "./input-microphone-essentia.ts"
import type { FrameFeatureName, FrameFeatures } from "../../analysis/essentia-features.ts"
import {
	matchChord,
	estimateKey,
	chordNotes,
	type ChordEstimate,
	type KeyEstimate
} from "../../analysis/chroma-harmony.ts"
import { createAudioCommand } from "../../commands/audio-command-factory.ts"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands.ts"
import { EVENT_HARMONY_CHANGED } from "../../events/event-constants.ts"

export const MICROPHONE_CHORDS_INPUT_ID = "microphone-chords"

export default class InputMicrophoneChords extends InputMicrophoneEssentia {
	readonly features: FrameFeatureName[] = ["chroma"]
	#window: number[][] = []
	#accumulated = new Array<number>(12).fill(0)
	#notes: number[] = []
	#chord?: ChordEstimate
	#candidate?: ChordEstimate
	#candidateSince = 0
	#quietSince?: number
	#key?: KeyEstimate

	get name(): string {
		return MICROPHONE_CHORDS_INPUT_ID
	}
	get description(): string {
		return "Follow microphone chords and key with Essentia.js (AGPL-3.0)"
	}
	get currentKey(): KeyEstimate | undefined {
		return this.#key && { ...this.#key }
	}

	constructor(options: Record<string, any> = {}) {
		// keyDecay is the per-frame weight kept by the accumulated chroma, so the key can follow modulations
		super({
			smoothingFrames: 4,
			scoreThreshold: 0.8,
			minHoldSeconds: 0.15,
			releaseSeconds: 0.2,
			rmsGate: 0.01,
			octave: 4,
			velocity: 100,
			keyDecay: 0.9995,
			...options
		})
	}

	processFrames(frames: FrameFeatures[]): void {
		for (const frame of frames) {
			if (
				!(frame.rms >= this.options.rmsGate) ||
				!frame.chroma ||
				frame.chroma.length !== 12 ||
				!frame.chroma.every(Number.isFinite) ||
				!frame.chroma.some((v) => v > 0)
			) {
				this.#window = []
				this.#candidate = undefined
				this.#quietSince ??= frame.time
				if (frame.time - this.#quietSince >= this.options.releaseSeconds) {
					this.#release()
				}
				continue
			}
			this.#quietSince = undefined
			this.#window.push(frame.chroma.slice())
			while (this.#window.length > Math.max(1, this.options.smoothingFrames)) {
				this.#window.shift()
			}
			const smooth = new Array<number>(12).fill(0)
			const decay = Math.max(0, Math.min(1, this.options.keyDecay))
			for (let i = 0; i < 12; i++) {
				for (const chroma of this.#window) {
					smooth[i] += chroma[i] / this.#window.length
				}
				this.#accumulated[i] = this.#accumulated[i] * decay + frame.chroma[i]
			}
			const key = estimateKey(this.#accumulated)
			const keyChanged = key?.root !== this.#key?.root || key?.scale !== this.#key?.scale
			this.#key = key
			if (keyChanged) {
				this.dispatchEvent(
					new CustomEvent(EVENT_HARMONY_CHANGED, { detail: this.currentKey })
				)
			}
			const chord = matchChord(smooth)
			if (!chord || chord.score < this.options.scoreThreshold) {
				this.#candidate = undefined
				continue
			}
			if (chord.root === this.#chord?.root && chord.quality === this.#chord?.quality) {
				this.#candidate = undefined
				continue
			}
			if (
				chord.root !== this.#candidate?.root ||
				chord.quality !== this.#candidate?.quality
			) {
				this.#candidate = chord
				this.#candidateSince = frame.time
			}
			if (frame.time - this.#candidateSince < this.options.minHoldSeconds) {
				continue
			}
			this.#release()
			this.#chord = chord
			const root = Math.max(
				0,
				Math.min(115, (Math.round(this.options.octave) + 1) * 12 + chord.root)
			)
			this.#notes = chordNotes(chord).map((pc) =>
				Math.min(127, root + ((pc - chord.root + 12) % 12))
			)
			for (const note of this.#notes) {
				const command = createAudioCommand(NOTE_ON, note, this.now, this.name)
				command.velocity = Math.max(1, Math.min(127, Math.round(this.options.velocity)))
				this.dispatch(command)
			}
		}
	}

	#release(): void {
		for (const note of this.#notes) {
			this.dispatch(createAudioCommand(NOTE_OFF, note, this.now, this.name))
		}
		this.#notes = []
		this.#chord = undefined
	}

	protected resetAnalysis(): void {
		this.#release()
		this.#window = []
		this.#accumulated.fill(0)
		this.#candidate = undefined
		this.#quietSince = undefined
		if (this.#key) {
			this.#key = undefined
			this.dispatchEvent(new CustomEvent(EVENT_HARMONY_CHANGED, { detail: undefined }))
		}
	}
}