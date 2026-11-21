import { importedSong, type SongSource } from "../formats/song-source"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { readMediaArchive, safeArchivePath, MAX_MEDIA_BYTES } from "./dropped-media"

export async function importMusicXMLFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("Score exceeds the 64 MB limit")
	}
	let text: string
	const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer())
	if (/\.mxl$/i.test(file.name) || (signature[0] === 0x50 && signature[1] === 0x4b)) {
		const files = await readMediaArchive(new Uint8Array(await file.arrayBuffer()))
		const container = files["META-INF/container.xml"]
		if (!container) {
			throw new Error("MXL archive is missing META-INF/container.xml")
		}
		const doc = parseXML(new TextDecoder().decode(container))
		const roots = [...doc.querySelectorAll("rootfile")]
		const root =
			roots.find(
				(entry) =>
					entry.getAttribute("media-type") === "application/vnd.recordare.musicxml+xml"
			) ?? roots[0]
		const path = safeArchivePath(root?.getAttribute("full-path") ?? "")
		if (!files[path]) {
			throw new Error("MXL archive is missing its root score")
		}
		text = new TextDecoder().decode(files[path])
	} else {
		text = await file.text()
	}
	const doc = parseXML(text)
	if (doc.documentElement.localName !== "score-partwise") {
		throw new Error("Expected a partwise MusicXML score")
	}
	const notes: {
		number: number
		start: number
		end: number
		velocity: number
		channel: number
		patch: number
		track: number
	}[] = []
	const tracks: SongSource["tracks"] = []
	const meters = new Map<number, { numerator: number; denominator: number }>()
	let key: SongSource["key"]
	const pending = new Map<string, (typeof notes)[number]>()
	const tempos = new Map<number, number>([[0, 120]])
	const pitches: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
	const parts = [...doc.documentElement.children].filter((el) => el.localName === "part")
	for (const [index, part] of parts.entries()) {
		const definition = [...doc.querySelectorAll("score-part")].find(
			(el) => el.getAttribute("id") === part.getAttribute("id")
		)
		const channel = Number(
			definition?.querySelector("midi-channel")?.textContent ?? (index % 16) + 1
		)
		const patch = Number(definition?.querySelector("midi-program")?.textContent ?? 1) - 1
		if (
			!Number.isInteger(channel) ||
			channel < 1 ||
			channel > 16 ||
			!Number.isInteger(patch) ||
			patch < 0 ||
			patch > 127
		) {
			throw new Error("Invalid MusicXML MIDI instrument")
		}
		tracks.push({
			name: definition?.querySelector("part-name")?.textContent ?? `Track ${index + 1}`,
			channel,
			patch,
			notes: []
		})
		let divisions = 1
		let measureStart = 0
		let velocity = 100
		for (const measure of part.children) {
			let cursor = measureStart,
				end = measureStart,
				chordStart = measureStart
			for (const el of measure.children) {
				if (el.localName === "attributes") {
					const time = el.querySelector("time")
					if (time?.querySelector("beats"))
						meters.set(cursor, {
							numerator: Number(time.querySelector("beats")!.textContent),
							denominator: Number(time.querySelector("beat-type")!.textContent)
						})
					const fifths = el.querySelector("key > fifths")
					if (fifths && !key)
						key = {
							fifths: Number(fifths.textContent),
							mode:
								el.querySelector("key > mode")?.textContent === "minor"
									? "minor"
									: "major"
						}
					divisions = Number(el.querySelector("divisions")?.textContent ?? divisions)
					if (!(divisions > 0)) {
						throw new Error("Invalid MusicXML divisions")
					}
				}
				if (el.localName === "direction" || el.localName === "sound") {
					const sound = el.localName === "sound" ? el : el.querySelector("sound[tempo]")
					const dynamic = el.querySelector("dynamics")?.firstElementChild?.localName
					const levels: Record<string, number> = {
						pppp: 10,
						ppp: 20,
						pp: 31,
						p: 49,
						mp: 64,
						mf: 80,
						f: 96,
						ff: 112,
						fff: 120,
						ffff: 127
					}
					if (dynamic && levels[dynamic] !== undefined) {
						velocity = levels[dynamic]
					}
					const tempo = Number(sound?.getAttribute("tempo"))
					if (tempo > 0) {
						tempos.set(
							cursor +
								Number(el.querySelector("offset")?.textContent ?? 0) / divisions,
							tempo
						)
					}
				}
				const duration = Number(el.querySelector("duration")?.textContent ?? 0) / divisions
				if (!Number.isFinite(duration) || duration < 0) {
					throw new Error("Invalid MusicXML duration")
				}
				if (el.localName === "backup") {
					cursor -= duration
				}
				if (el.localName === "forward") {
					cursor += duration
					end = Math.max(end, cursor)
				}
				if (el.localName !== "note") {
					continue
				}
				const chord = el.querySelector("chord") !== null
				const start = chord ? chordStart : cursor
				if (!chord) {
					chordStart = start
					cursor += duration
				}
				end = Math.max(end, start + duration)
				const pitch = el.querySelector("pitch")
				if (!pitch || duration === 0) {
					continue
				}
				const step = pitches[pitch.querySelector("step")?.textContent ?? ""]
				const number =
					(Number(pitch.querySelector("octave")?.textContent) + 1) * 12 +
					step +
					Number(pitch.querySelector("alter")?.textContent ?? 0)
				if (!Number.isInteger(number) || number < 0 || number > 127) {
					throw new Error("Unsupported MusicXML pitch")
				}
				const note = {
					number,
					start,
					end: start + duration,
					velocity: el.hasAttribute("dynamics")
						? Math.min(
								127,
								Math.max(
									0,
									Math.round((Number(el.getAttribute("dynamics")) * 90) / 100)
								)
							)
						: velocity,
					channel,
					patch,
					track: index
				}
				const tieKey = `${index}:${el.querySelector("voice")?.textContent ?? "1"}:${number}`
				const previous = pending.get(tieKey)
				const incoming = el.querySelector('tie[type="stop"]')
				const target =
					incoming && previous && Math.abs(previous.end - start) < 1e-8 ? previous : note
				if (target === note) notes.push(note)
				else target.end = note.end
				if (el.querySelector('tie[type="start"]')) pending.set(tieKey, target)
				else pending.delete(tieKey)
			}
			measureStart = end
		}
	}
	const changes = [...tempos].sort(([a], [b]) => a - b)
	const seconds = (beat: number) => {
		let time = 0,
			previous = 0,
			tempo = 120
		for (const [at, value] of changes) {
			if (at > beat) {
				break
			}
			time += ((at - previous) * 60) / tempo
			previous = at
			tempo = value
		}
		return time + ((beat - previous) * 60) / tempo
	}
	const commands = notes.flatMap((note) => [
		Object.assign(new AudioCommand(), {
			...note,
			type: NOTE_ON,
			startAt: seconds(note.start),
			endAt: seconds(note.end),
			from: file.name
		}),
		Object.assign(new AudioCommand(), {
			number: note.number,
			channel: note.channel,
			velocity: 0,
			type: NOTE_OFF,
			startAt: seconds(note.end),
			from: file.name
		})
	])
	commands.sort((a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : 1))
	if (!notes.length) {
		throw new Error("The MusicXML score contains no importable notes")
	}
	for (const note of notes)
		tracks[note.track].notes.push({
			number: note.number,
			channel: note.channel,
			patch: note.patch,
			velocity: note.velocity,
			start: seconds(note.start),
			duration: seconds(note.end) - seconds(note.start)
		})
	const song = importedSong({
		name: doc.querySelector("work-title")?.textContent ?? file.name,
		tempos: changes.map(([beat, bpm]) => ({ time: seconds(beat), bpm })),
		meters: [...meters].map(([beat, meter]) => ({ time: seconds(beat), ...meter })),
		key,
		tracks
	})
	return { commands, noteCount: notes.length, song }
}

export function parseXML(text: string): XMLDocument {
	const doc = new DOMParser().parseFromString(text, "application/xml")
	if (doc.querySelector("parsererror")) {
		throw new Error("Invalid XML format")
	}
	return doc
}