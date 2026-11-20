import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { MAX_MEDIA_BYTES } from "./dropped-media"

/** Magenta NoteSequence JSON, accepting protobuf camelCase and Python snake_case fields. */
export async function importNoteSequenceFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("NoteSequence exceeds the 64 MB limit")
	}
	const data = JSON.parse(await file.text())
	if (!data || !Array.isArray(data.notes) || data.notes.length > 100000) {
		throw new Error("Expected a NoteSequence with at most 100,000 notes")
	}
	const integer = (value: unknown, min: number, max: number) => {
		if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
			throw new Error("Invalid NoteSequence integer field")
		}
		return value
	}
	if (data.notes.some((note: unknown) => !note || typeof note !== "object")) {
		throw new Error("Invalid NoteSequence note")
	}
	if (
		data.notes.some((note: any) => typeof (note.isDrum ?? note.is_drum ?? false) !== "boolean")
	) {
		throw new Error("Invalid NoteSequence drum flag")
	}
	const instruments = [
		...new Set<number>(
			data.notes
				.filter((n: any) => !(n.isDrum ?? n.is_drum))
				.map((n: any) => integer(n.instrument ?? 0, 0, 65535))
		)
	].sort((a, b) => a - b)
	if (instruments.length > 15) {
		throw new Error("NoteSequence supports at most 15 melodic instruments plus drums")
	}
	const channels = new Map<number, number>()
	const free = Array.from({ length: 16 }, (_, i) => i + 1).filter((c) => c !== 10)
	for (const instrument of instruments.filter((id) => id < 15)) {
		channels.set(instrument, free[instrument])
	}
	for (const instrument of instruments.filter((id) => id >= 15)) {
		channels.set(instrument, free.find((c) => ![...channels.values()].includes(c))!)
	}
	const commands: AudioCommand[] = []
	let noteCount = 0
	for (const note of data.notes) {
		if (!note || typeof note !== "object") {
			throw new Error("Invalid NoteSequence note")
		}
		const number = integer(note.pitch, 0, 127),
			velocity = integer(note.velocity ?? 100, 0, 127)
		const patch = integer(note.program ?? 0, 0, 127),
			instrument = integer(note.instrument ?? 0, 0, 65535)
		let start = note.startTime ?? note.start_time,
			end = note.endTime ?? note.end_time
		if (start === undefined && end !== undefined) {
			start = 0
		}
		if (start === undefined || end === undefined) {
			const steps =
				data.quantizationInfo?.stepsPerQuarter ?? data.quantization_info?.steps_per_quarter
			const tempos = data.tempos ?? [{ qpm: 120, time: 0 }]
			if (
				!Number.isFinite(steps) ||
				steps <= 0 ||
				tempos.length !== 1 ||
				!Number.isFinite(tempos[0].qpm) ||
				tempos[0].qpm <= 0
			) {
				throw new Error("Quantized NoteSequence needs stepsPerQuarter and a single tempo")
			}
			start =
				(Number(note.quantizedStartStep ?? note.quantized_start_step ?? 0) * 60) /
				tempos[0].qpm /
				steps
			end =
				(Number(note.quantizedEndStep ?? note.quantized_end_step) * 60) /
				tempos[0].qpm /
				steps
		}
		if (
			typeof start !== "number" ||
			typeof end !== "number" ||
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			start < 0 ||
			end <= start ||
			end > 1800
		) {
			throw new Error(
				"NoteSequence note times must be finite, increasing seconds within 30 minutes"
			)
		}
		if (velocity === 0) {
			continue
		}
		const channel = (note.isDrum ?? note.is_drum) ? 10 : channels.get(instrument)!
		const common = { number, patch, channel, from: `${file.name}:instrument-${instrument}` }
		commands.push(
			Object.assign(new AudioCommand(), common, {
				type: NOTE_ON,
				velocity,
				startAt: start,
				endAt: end
			}),
			Object.assign(new AudioCommand(), common, { type: NOTE_OFF, velocity: 0, startAt: end })
		)
		noteCount++
	}
	if (!noteCount) {
		throw new Error("NoteSequence contains no importable notes")
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : b.type === NOTE_OFF ? 1 : 0)
	)
	return { commands, noteCount }
}