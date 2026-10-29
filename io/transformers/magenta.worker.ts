import type { MusicRNN } from "@magenta/music/esm/music_rnn"
import {
	MAGENTA_GENERATE,
	MAGENTA_RESULT,
	MAGENTA_STATUS,
	MAGENTA_ERROR
} from "./magenta-messages.ts"
import type { MagentaRequest } from "./magenta-messages.ts"

let model: MusicRNN | undefined
let checkpoint: string | undefined

self.onmessage = async ({ data }: MessageEvent<MagentaRequest>) => {
	if (data.kind !== MAGENTA_GENERATE) {
		return
	}
	try {
		// Magenta 1.x reads window.fetch/performance even in its MusicRNN entry.
		// Provide the worker equivalents before evaluating the library.
		const scope = globalThis as typeof globalThis & { window?: unknown }
		scope.window ??= globalThis
		const { MusicRNN } = await import("@magenta/music/esm/music_rnn")
		if (!model || checkpoint !== data.model) {
			model?.dispose()
			checkpoint = data.model
			model = new MusicRNN(
				`https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/${checkpoint}`
			)
			self.postMessage({
				kind: MAGENTA_STATUS,
				id: data.id,
				status: "Downloading Magenta model…"
			})
			await model.initialize()
		}
		self.postMessage({
			kind: MAGENTA_STATUS,
			id: data.id,
			status: "Generating supplementary melody…"
		})
		const result = await model.continueSequence(
			{
				notes: data.notes.map((note) => {
					let pitch = note.pitch
					while (pitch < 48) {
						pitch += 12
					}
					while (pitch > 83) {
						pitch -= 12
					}
					return { ...note, pitch }
				}),
				quantizationInfo: { stepsPerQuarter: 4 },
				totalQuantizedSteps: data.totalQuantizedSteps
			},
			data.steps,
			data.temperature,
			data.model === "chord_pitches_improv" ? data.chords : undefined
		)
		// protobufjs can return Long values here; the scheduler needs numbers.
		const notes = (result.notes ?? []).map((note) => ({
			pitch: Number(note.pitch),
			quantizedStartStep: Number(note.quantizedStartStep),
			quantizedEndStep: Number(note.quantizedEndStep)
		}))
		self.postMessage({ kind: MAGENTA_RESULT, id: data.id, notes })
	} catch (error) {
		model?.dispose()
		model = undefined
		self.postMessage({ kind: MAGENTA_ERROR, id: data.id, error: String(error) })
	}
}