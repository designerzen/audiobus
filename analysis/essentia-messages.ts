import type { FrameAnalyserOptions, FrameFeatures, TrackAnalysis } from "./essentia-features.ts"

export const ESSENTIA_ANALYSE_TRACK = "analyse-track"
export const ESSENTIA_STREAM_START = "stream-start"
export const ESSENTIA_STREAM_SAMPLES = "stream-samples"
export const ESSENTIA_STREAM_STOP = "stream-stop"
export const ESSENTIA_TRACK_RESULT = "track-result"
export const ESSENTIA_FRAME_RESULT = "frame-result"
export const ESSENTIA_ERROR = "error"

export type EssentiaRequest =
	| { type: typeof ESSENTIA_ANALYSE_TRACK; id: number; channels: Float32Array[] }
	| {
			type: typeof ESSENTIA_STREAM_START
			id: number
			options: FrameAnalyserOptions & { hopSize?: number }
	  }
	| { type: typeof ESSENTIA_STREAM_SAMPLES; id: number; samples: Float32Array }
	| { type: typeof ESSENTIA_STREAM_STOP; id: number }

export type EssentiaResponse =
	| { type: typeof ESSENTIA_TRACK_RESULT; id: number; result: TrackAnalysis }
	| { type: typeof ESSENTIA_FRAME_RESULT; id: number; frames: FrameFeatures[] }
	| { type: typeof ESSENTIA_ERROR; id: number; message: string }