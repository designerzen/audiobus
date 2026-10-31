import { validateMusicNotes, type AIMusicNote } from "./ai-music-messages"
import type { AIModelDefinition } from "./ai-model-catalogue"
import { DEFAULT_DRUM_PITCH_CLASSES } from "@magenta/music/esm/core/constants"

/** Magenta protobuf notes inherit velocity=0 when a converter omits dynamics. */
export function musicVelocity(value: unknown): number {
	const velocity = Number(value)
	return Number.isFinite(velocity) && velocity > 0
		? Math.max(1, Math.min(127, Math.round(velocity)))
		: 100
}

export function musicPrimer(notes: AIMusicNote[], steps: number, model: AIModelDefinition) {
	let prepared = validateMusicNotes(notes, steps)
	if (prepared.some((note) => !Number.isInteger(note.start) || !Number.isInteger(note.end)))
		throw new Error("Capture notes on the sixteenth-note grid")
	if (model.drums || model.trio) {
		const hits = new Map<string, AIMusicNote>()
		const melodic: AIMusicNote[] = []
		for (const note of prepared) {
			if (!model.drums && note.channel !== 10) {
				melodic.push(note)
				continue
			}
			const group = DEFAULT_DRUM_PITCH_CLASSES.find((group) => group.includes(note.pitch))
			if (!group)
				throw new Error(
					`Unsupported drum pitch ${note.pitch}; use General MIDI percussion pitches`
				)
			const key = `${note.start}:${group[0]}`,
				previous = hits.get(key)
			// DrumsOneHotConverter adds class bits; duplicate hits would encode
			// a different drum class. Merge equivalent hits before inference.
			hits.set(key, {
				...note,
				pitch: group[0],
				velocity: Math.max(note.velocity, previous?.velocity ?? 0),
				end: Math.max(note.end, previous?.end ?? 0)
			})
		}
		prepared = [...melodic, ...hits.values()].sort((a, b) => a.start - b.start)
	}
	const monophonic = (part: AIMusicNote[]) => {
		// MelodyRNN/MusicVAE melody encoders are monophonic. Retain rests and
		// durations, using the last played pitch for simultaneous melodic notes.
		const mono: AIMusicNote[] = []
		for (const note of part) {
			if (mono.at(-1)?.start === note.start) mono.pop()
			const previous = mono.at(-1)
			if (previous) previous.end = Math.min(previous.end, note.start)
			mono.push({ ...note })
		}
		return mono
	}
	if (!model.drums && !model.trio) prepared = monophonic(prepared)
	else if (model.trio)
		prepared = [
			...monophonic(prepared.filter((note) => note.channel === 1)),
			...monophonic(prepared.filter((note) => note.channel === 2)),
			...prepared.filter((note) => note.channel === 10)
		].sort((a, b) => a.start - b.start)
	return {
		notes: prepared.map((note) => {
			let pitch = note.pitch
			if (!model.drums && note.channel !== 10) {
				const low = model.engine === "rnn" ? 48 : 21,
					high = model.engine === "rnn" ? 83 : 108
				while (pitch < low) pitch += 12
				while (pitch > high) pitch -= 12
			}
			return {
				pitch,
				quantizedStartStep: note.start,
				quantizedEndStep: note.end,
				velocity: note.velocity,
				isDrum: !!model.drums || note.channel === 10,
				instrument: model.trio ? (note.channel === 10 ? 2 : note.channel === 2 ? 1 : 0) : 0,
				program: model.trio && note.channel === 2 ? 32 : 0
			}
		}),
		quantizationInfo: { stepsPerQuarter: 4 },
		totalQuantizedSteps: steps
	}
}