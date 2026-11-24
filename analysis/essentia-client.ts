/**
 * Main-thread access to the shared Essentia analysis worker.
 *
 * analyseAudioBuffer() measures tempo, beats, key and loudness of decoded audio.
 * createAnalysisStream() turns live sample chunks into per-frame features.
 */
import { ANALYSIS_SAMPLE_RATE } from "./essentia-features.ts"
import {
	ESSENTIA_ANALYSE_TRACK,
	ESSENTIA_ERROR,
	ESSENTIA_FRAME_RESULT,
	ESSENTIA_STREAM_SAMPLES,
	ESSENTIA_STREAM_START,
	ESSENTIA_STREAM_STOP,
	ESSENTIA_TRACK_RESULT,
	type EssentiaRequest,
	type EssentiaResponse
} from "./essentia-messages.ts"
import type { FrameAnalyserOptions, FrameFeatures, TrackAnalysis } from "./essentia-features.ts"

export type { FrameFeatures, TrackAnalysis } from "./essentia-features.ts"

type WorkerLike = Pick<Worker, "postMessage" | "addEventListener" | "terminate">

let createWorker = (): WorkerLike =>
	new Worker(new URL("./essentia.worker.ts", import.meta.url), { type: "module" })
let worker: WorkerLike | undefined
let nextId = 1
const listeners = new Map<number, (message: EssentiaResponse) => void>()

/** Replace the worker, for tests or hosts that bundle it differently. */
export function setEssentiaWorkerFactory(factory: () => WorkerLike): void {
	worker?.terminate()
	worker = undefined
	createWorker = factory
}

function send(message: EssentiaRequest, transfer: Transferable[] = []): void {
	try {
		post(message, transfer)
	} catch (error) {
		listeners.delete(message.id)
		throw error
	}
}

function post(message: EssentiaRequest, transfer: Transferable[]): void {
	if (!worker) {
		worker = createWorker()
		worker.addEventListener("message", (event) => {
			const data = (event as MessageEvent<EssentiaResponse>).data
			listeners.get(data.id)?.(data)
		})
	}
	worker.postMessage(message, transfer)
}

async function resample(buffer: AudioBuffer, maxSeconds: number): Promise<Float32Array[]> {
	const duration = Math.min(buffer.duration, maxSeconds)
	if (buffer.sampleRate === ANALYSIS_SAMPLE_RATE) {
		const length = Math.round(duration * ANALYSIS_SAMPLE_RATE)
		return Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, channel) =>
			buffer.getChannelData(channel).slice(0, length)
		)
	}
	const channels = Math.min(2, buffer.numberOfChannels)
	const context = new OfflineAudioContext(
		channels,
		Math.max(1, Math.round(duration * ANALYSIS_SAMPLE_RATE)),
		ANALYSIS_SAMPLE_RATE
	)
	const source = context.createBufferSource()
	source.buffer = buffer
	source.connect(context.destination)
	source.start()
	const rendered = await context.startRendering()
	return Array.from({ length: channels }, (_, channel) =>
		rendered.getChannelData(channel).slice()
	)
}

/** Tempo, beats, key and loudness of decoded audio; long files are analysed up to maxSeconds. */
export async function analyseAudioBuffer(
	buffer: AudioBuffer,
	{ maxSeconds = 180 }: { maxSeconds?: number } = {}
): Promise<TrackAnalysis> {
	const channels = await resample(buffer, maxSeconds)
	const id = nextId++
	return new Promise<TrackAnalysis>((resolve, reject) => {
		listeners.set(id, (message) => {
			listeners.delete(id)
			if (message.type === ESSENTIA_TRACK_RESULT) {
				resolve(message.result)
			} else {
				reject(
					new Error(message.type === ESSENTIA_ERROR ? message.message : "Analysis failed")
				)
			}
		})
		send(
			{ type: ESSENTIA_ANALYSE_TRACK, id, channels },
			channels.map((channel) => channel.buffer)
		)
	})
}

export interface AnalysisStream {
	/** Mono samples at the stream's sample rate, in any chunk size. */
	push(samples: Float32Array): void
	stop(): void
}

export function createAnalysisStream(
	options: FrameAnalyserOptions & { hopSize?: number },
	onFrames: (frames: FrameFeatures[]) => void,
	onError: (error: Error) => void = (error) => console.warn("[essentia]", error)
): AnalysisStream {
	const id = nextId++
	let stopped = false
	listeners.set(id, (message) => {
		if (stopped) {
			return
		}
		if (message.type === ESSENTIA_FRAME_RESULT) {
			onFrames(message.frames)
		} else if (message.type === ESSENTIA_ERROR) {
			onError(new Error(message.message))
		}
	})
	send({ type: ESSENTIA_STREAM_START, id, options })
	return {
		push(samples) {
			if (!stopped) {
				const copy = samples.slice()
				send({ type: ESSENTIA_STREAM_SAMPLES, id, samples: copy }, [copy.buffer])
			}
		},
		stop() {
			if (!stopped) {
				stopped = true
				listeners.delete(id)
				send({ type: ESSENTIA_STREAM_STOP, id })
			}
		}
	}
}