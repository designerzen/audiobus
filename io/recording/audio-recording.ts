import {
	RECORDING_STATE_CHANGED,
	RECORDING_PROCESSOR,
	RECORDING_START,
	RECORDING_STOP,
	RECORDING_OPEN,
	RECORDING_DATA,
	RECORDING_RECOVER,
	RECORDING_EXPORT,
	encodeSamples,
	waveHeader,
	type RecordingBits
} from "./recording-format"
import { getAudioDestination } from "../audio-destination"
import { convertAudioMedia, type AudioExportFormat } from "../media/audio-media"

// A plain URL rather than a bundler-specific import, so Vite and Parcel both emit the worklet as its own file.
const workletURL = new URL("./recording.worklet.js", import.meta.url).href

const MEMORY_LIMIT = 64 * 1024 * 1024
const WRITE_QUEUE_LIMIT = 16 * 1024 * 1024

export class AudioRecording extends EventTarget {
	state: "idle" | "starting" | "recording" | "stopping" = "idle"
	storage: "opfs" | "memory" = "memory"
	error = ""
	frames = 0
	sampleRate: number
	private worker?: Worker
	private node?: AudioWorkletNode
	private loaded = false
	private chunks: Float32Array[] = []
	private pending = new Map<
		number,
		{ resolve: (value: any) => void; reject: (error: Error) => void }
	>()
	private nextId = 0
	private queuedBytes = 0
	private captureFailed = false
	private workerFailed = false
	private stopped?: () => void
	private stopping?: Promise<void>
	private cached = new Map<RecordingBits, Blob>()
	/** When capture began, as performance.timeOrigin + performance.now(); unknown for a recovered take. */
	private startedAt?: number
	private cuts: { cutIn?: number; cutOut?: number } = {}
	readonly ready: Promise<void>

	constructor(
		private context: AudioContext,
		private source: AudioNode
	) {
		super()
		this.sampleRate = context.sampleRate
		this.ready = this.recover()
	}

	get duration() {
		return this.frames / this.sampleRate
	}
	get hasTake() {
		return this.frames > 0
	}
	private changed() {
		this.dispatchEvent(new Event(RECORDING_STATE_CHANGED))
	}

	private request(type: string, values: Record<string, unknown> = {}): Promise<any> {
		return new Promise((resolve, reject) => {
			if (this.workerFailed) {
				reject(new Error("Recording storage worker is unavailable."))
				return
			}
			const id = ++this.nextId
			this.pending.set(id, { resolve, reject })
			const samples = values.samples as Float32Array | undefined
			this.worker!.postMessage({ type, id, ...values }, samples ? [samples.buffer] : [])
		})
	}

	private async recover() {
		if (!navigator.storage?.getDirectory || typeof Worker === "undefined") {
			return
		}
		try {
			this.worker = new Worker(new URL("./recording-storage.worker.ts", import.meta.url), {
				type: "module"
			})
			this.worker.onmessage = ({ data }) => {
				const request = this.pending.get(data.id)
				this.pending.delete(data.id)
				if (data.error) {
					request?.reject(new Error(data.error))
				} else {
					request?.resolve(data.result)
				}
			}
			this.worker.onerror = () => {
				this.workerFailed = true
				for (const request of this.pending.values()) {
					request.reject(new Error("Recording storage worker failed."))
				}
				this.pending.clear()
				if (this.state === "recording") {
					this.fail("Recording storage stopped responding.")
				}
			}
			const take = await this.request(RECORDING_RECOVER)
			this.storage = "opfs"
			if (take) {
				this.frames = take.frames
				this.sampleRate = take.sampleRate
			}
		} catch {
			this.worker?.terminate()
			this.worker = undefined
			this.error =
				"OPFS is unavailable or in use by another tab. Recording will use limited memory."
		}
		this.changed()
	}

	async start() {
		if (this.state !== "idle") {
			return
		}
		this.state = "starting"
		this.changed()
		try {
			await this.ready
			await this.context.resume()
			if (!this.loaded) {
				await this.context.audioWorklet.addModule(workletURL)
				this.loaded = true
			}
			const node = new AudioWorkletNode(this.context, RECORDING_PROCESSOR, {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				outputChannelCount: [2],
				channelCount: 2,
				channelCountMode: "explicit"
			})
			node.port.onmessage = ({ data }) => {
				if (data.type === RECORDING_STOP) {
					this.stopped?.()
				} else if (data.type === RECORDING_DATA) {
					this.append(data.samples)
				}
			}
			node.onprocessorerror = () =>
				this.fail("Audio capture failed. The recorded portion has been retained.")
			// The worklet emits silence; connecting its output keeps processing alive.
			node.connect(this.context.destination)
			this.source.connect(node)
			this.node = node
			if (this.storage === "opfs") {
				const estimate = await navigator.storage.estimate()
				if (
					estimate.quota &&
					estimate.usage &&
					estimate.quota - estimate.usage < 16 * 1024 * 1024
				) {
					throw new Error(
						"Not enough browser storage to start recording. Export or clear site files first."
					)
				}
				await this.request(RECORDING_OPEN, { sampleRate: this.context.sampleRate })
				void navigator.storage.persist?.().catch(() => false)
			}
			this.frames = 0
			this.sampleRate = this.context.sampleRate
			this.chunks = []
			this.cached.clear()
			this.queuedBytes = 0
			this.captureFailed = false
			this.error = ""
			this.state = "recording"
			this.startedAt = performance.timeOrigin + performance.now()
			node.port.postMessage(RECORDING_START)
		} catch (error) {
			this.disconnect()
			this.state = "idle"
			this.error = error instanceof Error ? error.message : String(error)
		}
		this.changed()
	}

	private append(samples: Float32Array) {
		if (this.captureFailed) {
			return
		}
		if (this.state !== "recording" && this.state !== "stopping") {
			return
		}
		const bytes = samples.byteLength
		if (this.storage === "memory") {
			if (this.frames * 8 + bytes > MEMORY_LIMIT) {
				this.fail(
					"Memory recording limit reached. The take has been stopped and can be saved."
				)
				return
			}
			this.chunks.push(samples)
		} else {
			if (this.queuedBytes + bytes > WRITE_QUEUE_LIMIT) {
				this.fail("Storage cannot keep up with the audio. The take has been stopped.")
				return
			}
			this.queuedBytes += bytes
			void this.request(RECORDING_DATA, { samples })
				.catch((error) => this.fail(error.message))
				.finally(() => {
					this.queuedBytes -= bytes
				})
		}
		this.frames += bytes / 8
		this.changed()
	}

	private fail(message: string) {
		this.captureFailed = true
		this.error = message
		this.changed()
		if (this.state === "recording") {
			void this.stop()
		}
	}

	stop(): Promise<void> {
		if (this.stopping) {
			return this.stopping
		}
		if (this.state !== "recording") {
			return Promise.resolve()
		}
		this.state = "stopping"
		this.changed()
		this.stopping = this.finish().finally(() => {
			this.stopping = undefined
		})
		return this.stopping
	}

	private async finish() {
		try {
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					this.error ||= "Capture ended before the final audio batch was received."
					resolve()
				}, 3000)
				this.stopped = () => {
					clearTimeout(timeout)
					resolve()
				}
				this.node?.port.postMessage(RECORDING_STOP)
			})
			this.disconnect()
			if (this.storage === "opfs") {
				const take = await this.request(RECORDING_STOP)
				this.frames = take.frames
			}
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error)
		} finally {
			this.disconnect()
			this.state = "idle"
			this.changed()
		}
	}

	private disconnect() {
		if (this.node) {
			this.source.disconnect(this.node)
			this.node.disconnect()
			this.node.port.close()
			this.node = undefined
		}
		this.stopped = undefined
	}

	/**
	 * Trim saved audio to a cut in and end point, given as absolute times in milliseconds
	 * on the same clock as performance.timeOrigin + performance.now(), so the take need not
	 * start with the silence before the first note. Omitted points keep the take's own edges.
	 */
	setCuts(cuts: { cutIn?: number; cutOut?: number }) {
		this.cuts = { ...cuts }
		this.cached.clear()
		this.changed()
	}

	/** The frames the cuts keep, or undefined when the whole take is kept. */
	private trimmedFrames(): [number, number] | undefined {
		if (this.startedAt === undefined) {
			return
		}
		const frame = (time: number) =>
			Math.max(
				0,
				Math.min(
					this.frames,
					Math.round(((time - this.startedAt!) / 1000) * this.sampleRate)
				)
			)
		const start = this.cuts.cutIn === undefined ? 0 : frame(this.cuts.cutIn)
		const end = this.cuts.cutOut === undefined ? this.frames : frame(this.cuts.cutOut)
		return (start > 0 || end < this.frames) && end > start ? [start, end] : undefined
	}

	/** Compressed exports read the retained float WAV incrementally and can stream directly to disk. */
	async exportAudio(
		format: AudioExportFormat,
		onProgress?: (progress: number) => void,
		destination?: FileSystemWritableFileStream
	): Promise<Blob | undefined> {
		if (format === "16" || format === "32") {
			const blob = await this.wave(format === "16" ? 16 : 32)
			if (destination) {
				await blob.stream().pipeTo(destination)
				return
			}
			return blob
		}
		return convertAudioMedia(await this.wave(32), format, onProgress, destination)
	}

	async wave(bits: RecordingBits): Promise<Blob> {
		await this.ready
		if (this.state !== "idle" || !this.hasTake) {
			throw new Error("Stop recording before playing or saving the take.")
		}
		const cached = this.cached.get(bits)
		if (cached) {
			return cached
		}
		const file =
			this.storage === "opfs"
				? ((await this.request(RECORDING_EXPORT, { bits })) as File)
				: undefined
		// Memory fallback is explicitly capped; OPFS exports stay file-backed.
		const result =
			file ??
			new Blob(
				[
					waveHeader((this.frames * 2 * bits) / 8, this.sampleRate, bits),
					...this.chunks.map((chunk) => encodeSamples(chunk, bits))
				],
				{ type: "audio/wav" }
			)
		const range = this.trimmedFrames()
		const frameBytes = (2 * bits) / 8
		const headerBytes = bits === 32 ? 92 : 80
		const kept = range
			? new Blob(
					[
						waveHeader((range[1] - range[0]) * frameBytes, this.sampleRate, bits),
						result.slice(
							headerBytes + range[0] * frameBytes,
							headerBytes + range[1] * frameBytes
						)
					],
					{ type: "audio/wav" }
				)
			: result
		this.cached.set(bits, kept)
		return kept
	}
}

const recordings = new WeakMap<BaseAudioContext, AudioRecording>()

/**
 * The one take for a context, shared by every Recorder output and the host's controls.
 * It captures the final mix unless the first caller names another source.
 */
export function getAudioRecording(
	context: AudioContext,
	source: AudioNode = getAudioDestination(context)
): AudioRecording {
	let recording = recordings.get(context)
	if (!recording) {
		recording = new AudioRecording(context, source)
		recordings.set(context, recording)
	}
	return recording
}