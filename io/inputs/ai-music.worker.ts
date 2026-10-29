import { AI_MODELS } from "./ai-model-catalogue"
import {
	AI_MUSIC_GENERATE,
	AI_MUSIC_RESULT,
	AI_MUSIC_STATUS,
	AI_MUSIC_ERROR,
	validateMusicNotes
} from "./ai-music-messages"
import type { AIMusicRequest } from "./ai-music-messages"

self.onmessage = async ({ data }: MessageEvent<AIMusicRequest>) => {
	if (data.kind !== AI_MUSIC_GENERATE) {
		return
	}
	let model: { dispose(): void } | undefined
	try {
		const definition = Object.hasOwn(AI_MODELS, data.modelId)
			? AI_MODELS[data.modelId]
			: undefined
		if (!definition) {
			throw new Error("Unknown music model")
		}
		if (!Number.isFinite(data.temperature) || data.temperature < 0.1 || data.temperature > 2) {
			throw new Error("Invalid creativity")
		}
		const scope = globalThis as typeof globalThis & { window?: unknown }
		scope.window ??= globalThis
		self.postMessage({
			kind: AI_MUSIC_STATUS,
			id: data.id,
			status: `Downloading ${definition.name} model (about ${definition.sizeMB} MB)…`
		})
		let sequence
		if (definition.engine === "rnn") {
			if (
				!Array.isArray(data.seed) ||
				!data.seed.length ||
				data.seed.length > 32 ||
				!data.seed.every((pitch) => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127)
			) {
				throw new Error("Invalid MIDI primer")
			}
			const { MusicRNN } = await import("@magenta/music/esm/music_rnn")
			const rnn = new MusicRNN(definition.checkpoint)
			model = rnn
			await rnn.initialize()
			self.postMessage({
				kind: AI_MUSIC_STATUS,
				id: data.id,
				status: `Generating with ${definition.name}…`
			})
			sequence = await rnn.continueSequence(
				{
					notes: data.seed.map((pitch, i) => {
						if (!definition.drums) {
							while (pitch < 48) {
								pitch += 12
							}
							while (pitch > 83) {
								pitch -= 12
							}
						}
						return {
							pitch,
							quantizedStartStep: i * 4,
							quantizedEndStep: (i + 1) * 4,
							isDrum: !!definition.drums
						}
					}),
					quantizationInfo: { stepsPerQuarter: 4 },
					totalQuantizedSteps: data.seed.length * 4
				},
				definition.steps,
				data.temperature,
				definition.chords ? data.chords : undefined
			)
		} else {
			const { MusicVAE } = await import("@magenta/music/esm/music_vae")
			const vae = new MusicVAE(definition.checkpoint)
			model = vae
			await vae.initialize()
			self.postMessage({
				kind: AI_MUSIC_STATUS,
				id: data.id,
				status: `Generating with ${definition.name}…`
			})
			;[sequence] = await vae.sample(1, data.temperature)
		}
		const notes = validateMusicNotes(
			(sequence?.notes ?? []).map((note) => ({
				pitch: Number(note.pitch),
				start: Number(note.quantizedStartStep),
				end: Number(note.quantizedEndStep),
				velocity: Math.max(1, Math.min(127, Math.round(Number(note.velocity ?? 100)))),
				channel:
					note.isDrum || definition.drums
						? 10
						: definition.trio && Number(note.instrument) === 1
							? 2
							: 1
			})),
			definition.steps
		)
		self.postMessage({ kind: AI_MUSIC_RESULT, id: data.id, notes, steps: definition.steps })
	} catch (error) {
		self.postMessage({
			kind: AI_MUSIC_ERROR,
			id: data.id,
			error: error instanceof Error ? error.message : String(error)
		})
	} finally {
		model?.dispose()
	}
}