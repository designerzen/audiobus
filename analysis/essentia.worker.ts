/// <reference path="./essentia-modules.d.ts" />
/**
 * Essentia analysis worker. Loads the ~2.5 MB WASM build on first use so the
 * main thread and audio thread never block on analysis.
 */
import { analyseTrack, createFrameAnalyser, type FrameAnalyser } from "./essentia-features.ts"
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
import { StreamFramer } from "./stream-framer.ts"
import type Essentia from "essentia.js/dist/essentia.js-core.es.js"

let essentia: Promise<Essentia> | undefined
const streams = new Map<
	number,
	{ analyser: FrameAnalyser; framer: StreamFramer; sampleRate: number }
>()

function load(): Promise<Essentia> {
	return (essentia ??= (async () => {
		const [{ EssentiaWASM }, { default: EssentiaCore }] = await Promise.all([
			import("essentia.js/dist/essentia-wasm.es.js"),
			import("essentia.js/dist/essentia.js-core.es.js")
		])
		if (!EssentiaWASM.calledRun) {
			await new Promise<void>((resolve) => {
				EssentiaWASM.onRuntimeInitialized = resolve
			})
		}
		return new EssentiaCore(EssentiaWASM)
	})())
}

function reply(message: EssentiaResponse): void {
	self.postMessage(message)
}

// Messages are handled in order so stream samples never overtake their start.
let queue = Promise.resolve()

self.onmessage = (event: MessageEvent<EssentiaRequest>) => {
	const data = event.data
	queue = queue.then(async () => {
		try {
			switch (data.type) {
				case ESSENTIA_ANALYSE_TRACK: {
					const result = analyseTrack(await load(), data.channels)
					reply({ type: ESSENTIA_TRACK_RESULT, id: data.id, result })
					break
				}
				case ESSENTIA_STREAM_START: {
					const frameSize = data.options.frameSize ?? 2048
					streams.get(data.id)?.analyser.dispose()
					streams.set(data.id, {
						analyser: createFrameAnalyser(await load(), { ...data.options, frameSize }),
						framer: new StreamFramer(frameSize, data.options.hopSize ?? frameSize / 2),
						sampleRate: data.options.sampleRate
					})
					break
				}
				case ESSENTIA_STREAM_SAMPLES: {
					const stream = streams.get(data.id)
					if (!stream) {
						break
					}
					const frames = stream.framer
						.push(data.samples)
						.map(({ frame, offset }) =>
							stream.analyser.analyse(frame, offset / stream.sampleRate)
						)
					if (frames.length) {
						reply({ type: ESSENTIA_FRAME_RESULT, id: data.id, frames })
					}
					break
				}
				case ESSENTIA_STREAM_STOP:
					streams.get(data.id)?.analyser.dispose()
					streams.delete(data.id)
					break
			}
		} catch (error) {
			reply({
				type: ESSENTIA_ERROR,
				id: data.id,
				message: error instanceof Error ? error.message : String(error)
			})
		}
	})
}