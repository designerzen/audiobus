import type { MusicRNN } from "@magenta/music/esm/music_rnn"
import type { MusicVAE } from "@magenta/music/esm/music_vae"
import { AI_MODELS } from "./ai-model-catalogue"
import {
	AI_MUSIC_GENERATE,
	AI_MUSIC_RESULT,
	AI_MUSIC_STATUS,
	AI_MUSIC_ERROR,
	validateMusicNotes
} from "./ai-music-messages"
import type { AIMusicRequest } from "./ai-music-messages"
import { musicPrimer, musicVelocity } from "./ai-music-sequences"

let model: MusicRNN | MusicVAE | undefined
let modelId: string | undefined
let queue = Promise.resolve()

async function generate(data: AIMusicRequest): Promise<void> {
	try {
		const definition = Object.hasOwn(AI_MODELS, data.modelId)
			? AI_MODELS[data.modelId]
			: undefined
		if (!definition) throw new Error("Unknown music model")
		if (!Number.isFinite(data.temperature) || data.temperature < 0.1 || data.temperature > 2)
			throw new Error("Invalid creativity")
		if (data.operation && data.operation !== "variation")
			throw new Error("Invalid generation operation")
		const scope = globalThis as typeof globalThis & { window?: unknown }
		scope.window ??= globalThis
		if (!model || modelId !== data.modelId) {
			model?.dispose()
			model = undefined
			modelId = undefined
			self.postMessage({
				kind: AI_MUSIC_STATUS,
				id: data.id,
				status: `Downloading ${definition.name} model (about ${definition.sizeMB} MB)…`
			})
			if (definition.engine === "rnn") {
				const { MusicRNN } = await import("@magenta/music/esm/music_rnn")
				model = new MusicRNN(definition.checkpoint)
			} else {
				const { MusicVAE } = await import("@magenta/music/esm/music_vae")
				model = new MusicVAE(definition.checkpoint)
			}
			await model.initialize()
			modelId = data.modelId
		}
		self.postMessage({
			kind: AI_MUSIC_STATUS,
			id: data.id,
			status: `Generating with ${definition.name}…`
		})
		let sequence
		if (definition.engine === "rnn") {
			let notes = data.notes,
				steps = data.seedSteps
			if (!notes) {
				if (
					!Array.isArray(data.seed) ||
					!data.seed.length ||
					data.seed.length > 32 ||
					!data.seed.every(
						(pitch) => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127
					)
				)
					throw new Error("Invalid MIDI primer")
				steps = data.seed.length * 4
				notes = data.seed.map((pitch, i) => ({
					pitch,
					start: i * 4,
					end: (i + 1) * 4,
					velocity: 100,
					channel: definition.drums ? 10 : 1
				}))
			}
			if (
				definition.chords &&
				(!data.chords?.length ||
					data.chords.length > 32 ||
					data.chords.some((chord) => typeof chord !== "string" || chord.length > 24))
			)
				throw new Error("Enter a chord progression")
			sequence = await (model as MusicRNN).continueSequence(
				musicPrimer(notes, steps!, definition),
				definition.steps,
				data.temperature,
				definition.chords ? data.chords : undefined
			)
		} else if (data.operation === "variation") {
			if (!data.notes || data.seedSteps !== definition.steps)
				throw new Error("Capture a complete phrase before generating variations")
			const similarity = Number(data.similarity ?? 0.7)
			if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1)
				throw new Error("Invalid similarity")
			;[sequence] = await (model as MusicVAE).similar(
				musicPrimer(data.notes, data.seedSteps, definition),
				1,
				similarity,
				data.temperature
			)
		} else {
			;[sequence] = await (model as MusicVAE).sample(1, data.temperature)
		}
		const notes = validateMusicNotes(
			(sequence?.notes ?? []).map((note) => ({
				pitch: Number(note.pitch),
				start: Number(note.quantizedStartStep),
				end: Number(note.quantizedEndStep),
				velocity: musicVelocity(note.velocity),
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
		model?.dispose()
		model = undefined
		modelId = undefined
		self.postMessage({
			kind: AI_MUSIC_ERROR,
			id: data.id,
			error: error instanceof Error ? error.message : String(error)
		})
	}
}
self.onmessage = ({ data }: MessageEvent<AIMusicRequest>) => {
	if (data.kind !== AI_MUSIC_GENERATE) return
	// Keep the initialized model warm, serializing requests to protect tensor state.
	queue = queue.then(() => generate(data))
	return queue
}