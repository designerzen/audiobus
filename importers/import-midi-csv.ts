import { songFromCommands } from "../formats/song-source"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND } from "../commands/commands"
import { MAX_MEDIA_BYTES } from "./dropped-media"

// MIDICSV text fields may contain commas, doubled quotes and newlines.
function csvRows(text: string): string[][] {
	const rows: string[][] = []
	let row: string[] = [],
		field = "",
		quoted = false
	for (let i = 0; i < text.length; i++) {
		const c = text[i]
		if (c === '"') {
			if (quoted && text[i + 1] === '"') {
				field += '"'
				i++
			} else {
				quoted = !quoted
			}
		} else if (!quoted && (c === "," || c === "\n")) {
			row.push(field.trim())
			field = ""
			if (c === "\n") {
				if (row.some(Boolean)) {
					rows.push(row)
				}
				row = []
			}
		} else {
			field += c
		}
	}
	if (quoted) {
		throw new Error("Unterminated quoted MIDI CSV field")
	}
	row.push(field.trim())
	if (row.some(Boolean)) {
		rows.push(row)
	}
	return rows
}
export async function importMIDICSVFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("MIDI CSV exceeds the 64 MB limit")
	}
	const rows = csvRows((await file.text()).replace(/^\uFEFF/, "")).filter(
		(row) => !/^[#;]/.test(row[0])
	)
	const integer = (value: string | undefined, min: number, max: number) => {
		if (!value?.trim()) {
			throw new Error("Missing MIDI CSV value")
		}
		const n = Number(value)
		if (!Number.isSafeInteger(n) || n < min || n > max) {
			throw new Error(`Invalid MIDI CSV value: ${value}`)
		}
		return n
	}
	const header = rows.shift()
	if (!header || header[2]?.toLowerCase() !== "header" || header.length !== 6) {
		throw new Error("Expected a standard MIDICSV Header record")
	}
	const format = integer(header[3], 0, 2)
	if (format === 2) {
		throw new Error("Asynchronous MIDI CSV format 2 is not supported")
	}
	const tracks = integer(header[4], 1, 65535),
		ppq = integer(header[5], 1, 32767)
	const records = rows
		.filter((row) => !/^[#;]/.test(row[0]))
		.map((row, index) => ({
			row,
			index,
			track: integer(row[0], 0, tracks),
			tick: integer(row[1], 0, Number.MAX_SAFE_INTEGER),
			type: row[2]?.toLowerCase()
		}))
		.sort((a, b) => a.tick - b.tick || a.index - b.index)
	const tempos = records
		.filter((r) => r.type === "tempo")
		.map((r) => ({ tick: r.tick, micros: integer(r.row[3], 1, 0xffffff) }))
	const changes = [{ tick: 0, micros: 500000, seconds: 0 }]
	for (const tempo of tempos) {
		const previous = changes.at(-1)!
		changes.push({
			...tempo,
			seconds:
				previous.seconds + ((tempo.tick - previous.tick) * previous.micros) / ppq / 1000000
		})
	}
	const seconds = (tick: number) => {
		let low = 0,
			high = changes.length
		while (low + 1 < high) {
			const mid = (low + high) >>> 1
			if (changes[mid].tick <= tick) {
				low = mid
			} else {
				high = mid
			}
		}
		const change = changes[low]
		return change.seconds + ((tick - change.tick) * change.micros) / ppq / 1000000
	}
	const commands: AudioCommand[] = [],
		programs = new Map<string, number>()
	const pending = new Map<string, AudioCommand[]>()
	let noteCount = 0
	for (const record of records) {
		const { row, tick, type, track } = record
		if (
			!["note_on_c", "note_off_c", "program_c", "control_c", "pitch_bend_c"].includes(
				type ?? ""
			)
		) {
			continue
		}
		if (!track) {
			throw new Error("MIDI channel events require a nonzero track")
		}
		const channel = integer(row[3], 0, 15) + 1
		const startAt = seconds(tick),
			source = `${file.name}:track-${track}`,
			key = `${track}:${channel}`
		const command = Object.assign(new AudioCommand(), { channel, startAt, from: source })
		if (type === "program_c") {
			command.type = PROGRAM_CHANGE
			command.value = integer(row[4], 0, 127)
			command.number = command.value
			programs.set(key, command.value)
		} else if (type === "pitch_bend_c") {
			command.type = PITCH_BEND
			command.value = integer(row[4], 0, 16383)
			command.pitchBend = command.value
		} else {
			command.number = integer(row[4], 0, 127)
			const value = integer(row[5], 0, 127)
			if (type === "control_c") {
				command.type = CONTROL_CHANGE
				command.value = value
			} else {
				command.type = type === "note_on_c" && value > 0 ? NOTE_ON : NOTE_OFF
				command.velocity = value
				command.patch = programs.get(key) ?? 0
				const noteKey = `${key}:${command.number}`,
					queue = pending.get(noteKey) ?? []
				if (command.type === NOTE_ON) {
					queue.push(command)
					pending.set(noteKey, queue)
					noteCount++
				} else {
					const on = queue.shift()
					if (on) {
						on.endAt = startAt
					}
				}
			}
		}
		commands.push(command)
	}
	const end = seconds(records.at(-1)?.tick ?? 0)
	for (const queue of pending.values()) {
		for (const on of queue) {
			on.endAt = Math.max(end, on.startAt + 0.1)
			commands.push(
				Object.assign(new AudioCommand(), {
					type: NOTE_OFF,
					number: on.number,
					channel: on.channel,
					startAt: on.endAt,
					from: on.from
				})
			)
		}
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : b.type === NOTE_OFF ? 1 : 0)
	)
	if (!noteCount) {
		throw new Error("MIDI CSV contains no importable notes")
	}
	const signature = records.find((r) => r.type === "key_signature")
	const song = songFromCommands(
		commands,
		records.find((r) => r.type === "title_t" && r.track === 1)?.row[3] ?? file.name,
		{
			tempos: changes.map((t) => ({ time: t.seconds, bpm: 60000000 / t.micros })),
			meters: records
				.filter((r) => r.type === "time_signature")
				.map((r) => ({
					time: seconds(r.tick),
					numerator: integer(r.row[3], 1, 64),
					denominator: 2 ** integer(r.row[4], 0, 6)
				})),
			key: signature
				? {
						fifths: integer(signature.row[3], -7, 7),
						mode: signature.row[4]?.toLowerCase() === "minor" ? "minor" : "major"
					}
				: undefined
		}
	)
	for (const track of song.tracks) {
		const index = Number(track.source?.split("track-").at(-1))
		track.name =
			records.find((r) => r.type === "title_t" && r.track === index)?.row[3] ?? track.name
	}
	return { commands, noteCount, song }
}