import AbstractInput from "./abstract-input.ts"
import { loadCaptureWorklet } from "./load-capture-worklet.ts"
import { createAnalysisStream, type AnalysisStream } from "../../analysis/essentia-client.ts"
import type { FrameFeatureName, FrameFeatures } from "../../analysis/essentia-features.ts"
import { EVENT_ERROR } from "../../events/event-constants.ts"

const PROCESSOR = "essentia-microphone-capture"
const CAPTURE_CODE = `
class EssentiaMicrophoneCapture extends AudioWorkletProcessor {
	constructor() {
		super()
		this.samples = new Float32Array(512)
		this.offset = 0
	}
	process(inputs) {
		const channels = inputs[0]
		if (!channels?.length) return true
		for (let i = 0; i < channels[0].length; i++) {
			let mono = 0
			for (const channel of channels) mono += channel[i] / channels.length
			this.samples[this.offset++] = mono
			if (this.offset === this.samples.length) {
				this.port.postMessage(this.samples.slice())
				this.offset = 0
			}
		}
		return true
	}
}
registerProcessor('${PROCESSOR}', EssentiaMicrophoneCapture)
`

/** Shared capture lifecycle for Essentia.js (AGPL-3.0) microphone inputs. */
export default abstract class InputMicrophoneEssentia extends AbstractInput {
	abstract readonly features: FrameFeatureName[]
	abstract processFrames(frames: FrameFeatures[]): void
	protected abstract resetAnalysis(): void
	#stream?: AnalysisStream
	#media?: MediaStream
	#source?: MediaStreamAudioSourceNode
	#capture?: AudioWorkletNode
	#generation = 0
	#connecting?: Promise<Function>
	error?: Error

	get isListening(): boolean {
		return this.isConnected
	}
	hasAudioInput(): boolean {
		return true
	}

	connect(): Promise<Function> {
		if (this.isConnected) {
			return Promise.resolve(() => this.disconnect())
		}
		if (this.#connecting) {
			return this.#connecting
		}
		const generation = ++this.#generation
		const pending = this.#connect(generation)
		this.#connecting = pending
		void pending
			.finally(() => {
				if (this.#connecting === pending) {
					this.#connecting = undefined
				}
			})
			.catch(() => {})
		return pending
	}

	async #connect(generation: number): Promise<Function> {
		this.error = undefined
		try {
			const context: AudioContext | undefined = this.options.audioContext
			if (!context) {
				throw new Error(`${this.name} requires audioContext`)
			}
			if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
				throw new Error("Microphone unavailable")
			}
			await loadCaptureWorklet(context, PROCESSOR, CAPTURE_CODE)
			if (generation !== this.#generation) {
				return () => this.disconnect()
			}
			// A context created before the user gesture stays suspended and would deliver no audio
			if (context.state === "suspended") {
				await context.resume().catch(() => {})
			}
			if (generation !== this.#generation) {
				return () => this.disconnect()
			}
			const media = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
			})
			if (generation !== this.#generation) {
				media.getTracks().forEach((track) => track.stop())
				return () => this.disconnect()
			}
			this.#media = media
			this.#source = context.createMediaStreamSource(media)
			this.#capture = new AudioWorkletNode(context, PROCESSOR)
			this.#stream = createAnalysisStream(
				{
					sampleRate: context.sampleRate,
					frameSize: this.options.frameSize ?? 2048,
					hopSize: this.options.hopSize ?? 512,
					features: this.features,
					pitchMinFrequency: this.options.pitchMinFrequency,
					pitchMaxFrequency: this.options.pitchMaxFrequency
				},
				(frames) => {
					if (this.isListening) {
						this.processFrames(frames)
					}
				},
				(error) => this.#fail(error)
			)
			this.#capture.port.onmessage = (event: MessageEvent<Float32Array>) =>
				this.#stream?.push(event.data)
			this.#source.connect(this.#capture)
			// The processor outputs silence, but needs a destination to keep rendering.
			this.#capture.connect(context.destination)
			this.setAsConnected()
			return () => this.disconnect()
		} catch (error) {
			// Stopped while connecting: a late permission error is not worth reporting
			if (generation !== this.#generation) {
				return () => this.disconnect()
			}
			this.#fail(error)
			throw error
		}
	}

	#fail(error: unknown): void {
		this.disconnect()
		this.error = error instanceof Error ? error : new Error(String(error))
		this.dispatchEvent(new CustomEvent(EVENT_ERROR, { detail: this.error }))
	}

	disconnect(): void {
		++this.#generation
		this.#connecting = undefined
		this.#stream?.stop()
		this.#stream = undefined
		if (this.#capture) {
			this.#capture.port.onmessage = null
			this.#capture.port.close()
			this.#capture.disconnect()
		}
		this.#capture = undefined
		this.#source?.disconnect()
		this.#source = undefined
		this.#media?.getTracks().forEach((track) => track.stop())
		this.#media = undefined
		this.resetAnalysis()
		this.setAsDisconnected()
	}

	stop(): void {
		this.disconnect()
	}
	destroy(): void {
		this.disconnect()
	}
}