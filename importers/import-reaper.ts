import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import {
	parseReaperProject,
	reaperChunks,
	reaperField,
	reaperLines,
	reaperNumber,
	reaperTimeAxis,
	type ReaperChunk
} from "../formats/reaper-project"
import type { SequenceNote } from "../formats/note-sequence"

interface TickNote {
	number: number
	channel: number
	patch: number
	velocity: number
	start: number
	end: number
}
function readMIDI(source: ReaperChunk) {
	const data = reaperField(source, "HASDATA"),
		ppq = reaperNumber(data[1])
	if (
		data[0] !== "1" ||
		data[2] !== "QN" ||
		!Number.isSafeInteger(ppq) ||
		ppq <= 0 ||
		ppq > 1000000
	) {
		throw new Error("Expected embedded REAPER MIDI with a valid PPQ resolution")
	}
	const patches = Array<number>(16).fill(0),
		pending = new Map<string, TickNote[]>()
	const notes: TickNote[] = []
	let tick = 0
	const advance = (value: string | undefined) => {
		const delta = reaperNumber(value)
		if (!Number.isSafeInteger(delta) || delta < 0 || !Number.isSafeInteger(tick + delta)) {
			throw new Error("Invalid REAPER MIDI event delta")
		}
		tick += delta
	}
	for (const entry of source.entries) {
		if (!Array.isArray(entry)) {
			if (/^[Xx](?:m)?$/.test(entry.tag)) {
				advance(entry.args[0])
			}
			continue
		}
		if (!/^[Ee](?:m)?$/.test(entry[0])) {
			continue
		}
		advance(entry[1])
		const bytes = entry
			.slice(2)
			.map((byte) => (/^[0-9a-f]{2}$/i.test(byte) ? parseInt(byte, 16) : NaN))
		const status = bytes[0],
			type = status & 0xf0,
			channel = status & 15
		if (
			!Number.isInteger(status) ||
			status < 0x80 ||
			bytes.some((byte) => !Number.isInteger(byte)) ||
			(status < 0xf0 &&
				(bytes.length !== ([0xc0, 0xd0].includes(type) ? 2 : 3) ||
					bytes.slice(1).some((byte) => byte > 127)))
		) {
			throw new Error("Invalid REAPER MIDI event bytes")
		}
		if (entry[0].endsWith("m")) {
			continue
		}
		if (type === 0xc0) {
			patches[channel] = bytes[1]
			continue
		}
		const key = `${channel}:${bytes[1]}`
		if (type === 0x90 && bytes[2]) {
			if (notes.length >= 100000) {
				throw new Error("REAPER source contains too many notes")
			}
			const note = {
				number: bytes[1],
				channel: channel + 1,
				patch: patches[channel],
				velocity: bytes[2],
				start: tick,
				end: -1
			}
			const queue = pending.get(key) ?? []
			queue.push(note)
			pending.set(key, queue)
			notes.push(note)
		} else if (type === 0x80 || type === 0x90) {
			const note = pending.get(key)?.shift()
			if (note) {
				note.end = tick
			}
		} else if (type === 0xb0 && [120, 123].includes(bytes[1])) {
			for (const [key, queue] of pending) {
				if (key.startsWith(`${channel}:`)) {
					for (const note of queue) {
						note.end = tick
					}
					pending.delete(key)
				}
			}
		}
	}
	if (notes.some((note) => note.end < note.start)) {
		throw new Error("REAPER source contains unterminated notes")
	}
	return { ppq, ticks: tick, notes }
}

/** Import embedded MIDI clips; external media and FX are never fetched or executed. */
export async function importReaperFile(file: File) {
	checkMusicFile(file)
	const project = parseReaperProject(await file.text()),
		axis = reaperTimeAxis(project)
	const pools = new Map<string, ReaperChunk>()
	const tracks = reaperChunks(project, "TRACK")
	for (const track of tracks) {
		for (const item of reaperChunks(track, "ITEM")) {
			for (const source of reaperChunks(item, "SOURCE")) {
				const pool = reaperField(source, "POOLEDEVTS")[0]
				if (
					pool &&
					reaperLines(source, "HASDATA").length &&
					source.entries.some(
						(entry) => Array.isArray(entry) && /^[Ee](?:m)?$/.test(entry[0])
					)
				) {
					pools.set(pool, source)
				}
			}
		}
	}
	const commands = []
	let noteCount = 0
	for (const [index, track] of tracks.entries()) {
		if (reaperField(track, "MUTESOLO")[0] === "1") {
			continue
		}
		const notes: SequenceNote[] = []
		for (const item of reaperChunks(track, "ITEM")) {
			if (reaperField(item, "MUTE")[0] === "1") {
				continue
			}
			const sources = reaperChunks(item, "SOURCE")
			if (!sources.some((source) => source.args[0] === "MIDI")) {
				continue
			}
			if (
				sources.length !== 1 ||
				reaperLines(item, "TAKE").length ||
				reaperChunks(item, "TAKE").length
			) {
				throw new Error("Crop REAPER MIDI items to their active take before importing")
			}
			const original = sources[0],
				pool = reaperField(original, "POOLEDEVTS")[0]
			const hasEvents = original.entries.some(
				(entry) => Array.isArray(entry) && /^[Ee](?:m)?$/.test(entry[0])
			)
			const source = !hasEvents && pool ? pools.get(pool) : original
			if (!source || reaperLines(source, "FILE").length) {
				throw new Error(
					"REAPER MIDI must be embedded; import external .mid files separately"
				)
			}
			const position = reaperNumber(reaperField(item, "POSITION")[0], 0),
				length = reaperNumber(reaperField(item, "LENGTH")[0])
			const rate = reaperNumber(reaperField(item, "PLAYRATE")[0], 1),
				offset = reaperNumber(reaperField(item, "SOFFS")[0], 0)
			const pitchOffset = reaperNumber(reaperField(item, "PLAYRATE")[2], 0)
			if (!Number.isInteger(pitchOffset)) {
				throw new Error(
					"REAPER fractional take transposition cannot be represented as MIDI notes"
				)
			}
			if (
				position < 0 ||
				length <= 0 ||
				position + length > 1800 ||
				rate <= 0 ||
				rate > 100
			) {
				throw new Error("Invalid REAPER MIDI item bounds or play rate")
			}
			if (offset !== 0) {
				throw new Error(
					"Glue slip-edited REAPER MIDI items before importing (nonzero source offset)"
				)
			}
			const parsed = readMIDI(source),
				origin = axis.beats(position)
			const ignore = reaperField(source, "IGNTEMPO"),
				fixedBPM = reaperNumber(ignore[1], 120)
			if (ignore[0] === "1" && !(fixedBPM > 0 && fixedBPM <= 10000)) {
				throw new Error("Invalid REAPER source tempo")
			}
			const time = (tick: number) =>
				ignore[0] === "1"
					? position + ((tick / parsed.ppq) * 60) / fixedBPM / rate
					: axis.seconds(origin + tick / parsed.ppq / rate)
			const looping = reaperField(item, "LOOP")[0] === "1"
			if (!parsed.ticks && parsed.notes.length) {
				throw new Error("Invalid REAPER MIDI source length")
			}
			for (let repeat = 0; ; repeat++) {
				if (repeat > 100000) {
					throw new Error("REAPER loop exceeds the note limit")
				}
				const shift = repeat * parsed.ticks
				if (repeat && (!looping || !parsed.ticks || time(shift) >= position + length)) {
					break
				}
				for (const note of parsed.notes) {
					const start = Math.max(position, time(shift + note.start)),
						end = Math.min(position + length, time(shift + note.end))
					if (end <= start) {
						continue
					}
					if (noteCount + notes.length >= 100000) {
						throw new Error("REAPER project exceeds 100,000 notes")
					}
					notes.push({
						number: note.number + pitchOffset,
						channel: note.channel,
						patch: note.patch,
						velocity: note.velocity,
						start,
						duration: end - start
					})
				}
				if (!looping || !parsed.ticks) {
					break
				}
			}
		}
		if (notes.length) {
			const result = commandsFromNotes(
				notes,
				reaperField(track, "NAME")[0] ?? `Track ${index + 1}`
			)
			for (const command of result.commands) {
				commands.push(command)
			}
			noteCount += result.noteCount
		}
	}
	if (!noteCount) {
		throw new Error("REAPER project contains no importable embedded MIDI notes")
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.velocity === 0 ? -1 : b.velocity === 0 ? 1 : 0)
	)
	return { commands, noteCount }
}