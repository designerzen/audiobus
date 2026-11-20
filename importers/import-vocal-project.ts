import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import { projectTick, projectTimeAxis, parseMusicJSON } from "../formats/project-time"
import type { SequenceNote } from "../formats/note-sequence"

const list = (value: unknown): any[] => {
	if (!Array.isArray(value) || value.length > 100000) {
		throw new Error("Invalid project list or too many entries")
	}
	return value
}
const channel = (index: number) => {
	if (!Number.isInteger(index) || index < 0 || index >= 15) {
		throw new Error("Vocal projects support at most 15 melodic tracks")
	}
	return index < 9 ? index + 1 : index + 2
}
function addNote(
	notes: SequenceNote[],
	pitch: number,
	tick: number,
	duration: number,
	track: number,
	time: (tick: number) => number
) {
	if (notes.length >= 100000 || !projectTick(duration)) {
		throw new Error("Too many project notes or zero duration")
	}
	const start = time(tick),
		end = time(tick + duration)
	notes.push({
		number: pitch,
		start,
		duration: end - start,
		velocity: 100,
		channel: channel(track),
		patch: 0
	})
}

export async function importUFDataFile(file: File) {
	checkMusicFile(file)
	const data = parseMusicJSON(await file.text())
	if (data?.formatVersion !== 1 || !data.project) {
		throw new Error("Expected UtaFormatix data version 1")
	}
	const project = data.project
	const time = projectTimeAxis(
		480,
		list(project.tempos).map((tempo) => ({ position: tempo?.tickPosition, bpm: tempo?.bpm }))
	)
	const notes: SequenceNote[] = []
	for (const [index, track] of list(project.tracks).entries()) {
		for (const note of list(track?.notes)) {
			addNote(
				notes,
				note?.key,
				projectTick(note?.tickOn),
				projectTick(note?.tickOff) - note.tickOn,
				index,
				time
			)
		}
	}
	return commandsFromNotes(notes, file.name)
}

export async function importUSTXFile(file: File) {
	checkMusicFile(file)
	const { parse } = await import("yaml")
	const data = parse(await file.text(), { maxAliasCount: 0, schema: "core" })
	if (!data?.ustx_version || !Array.isArray(data.voice_parts)) {
		throw new Error("Expected an OpenUtau USTX project")
	}
	const time = projectTimeAxis(
		data.resolution ?? 480,
		list(data.tempos ?? [{ position: 0, bpm: data.bpm ?? 120 }])
	)
	const notes: SequenceNote[] = []
	for (const part of data.voice_parts) {
		const offset = projectTick(part?.position)
		for (const note of list(part.notes)) {
			addNote(
				notes,
				note?.tone,
				offset + projectTick(note?.position),
				projectTick(note?.duration),
				part.track_no,
				time
			)
		}
	}
	return commandsFromNotes(notes, file.name)
}

export async function importSVPFile(file: File) {
	checkMusicFile(file)
	const data = parseMusicJSON(await file.text())
	if (!data?.time || !Array.isArray(data.tracks)) {
		throw new Error("Expected a Synthesizer V project")
	}
	const time = projectTimeAxis(705600000, list(data.time.tempo ?? []))
	const library = new Map<string, any>()
	for (const group of list(data.library ?? [])) {
		if (typeof group?.uuid !== "string" || library.has(group.uuid)) {
			throw new Error("Invalid or duplicate Synthesizer V group ID")
		}
		library.set(group.uuid, group)
	}
	const notes: SequenceNote[] = []
	for (const [index, track] of list(data.tracks).entries()) {
		const groups = list(track?.groups ?? []).map((ref) => ({
			ref,
			group: library.get(ref?.groupID)
		}))
		if (track.mainGroup) {
			groups.unshift({ ref: track.mainRef ?? {}, group: track.mainGroup })
		}
		for (const { ref, group } of groups) {
			if (ref?.isInstrumental) {
				continue
			}
			if (!ref || !group) {
				throw new Error("Synthesizer V group reference is missing from the library")
			}
			const offset = ref.blickOffset ?? 0,
				pitchOffset = ref.pitchOffset ?? 0
			if (!Number.isSafeInteger(offset) || !Number.isInteger(pitchOffset)) {
				throw new Error("Invalid Synthesizer V group offset")
			}
			for (const note of list(group.notes)) {
				addNote(
					notes,
					typeof note?.pitch === "number" ? note.pitch + pitchOffset : NaN,
					projectTick(note?.onset) + offset,
					projectTick(note?.duration),
					index,
					time
				)
			}
		}
	}
	return commandsFromNotes(notes, file.name)
}