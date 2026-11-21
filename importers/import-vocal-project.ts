import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import { projectTick, projectTimeAxis, parseMusicJSON } from "../formats/project-time"
import type { SequenceNote } from "../formats/note-sequence"
import { importedSong, meterTimes, type SongSource } from "../formats/song-source"

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
/** Song metadata from project tempo lists, bar-indexed meters and track names.
 * Metadata is optional, so malformed entries are skipped rather than failing the import.
 */
function projectSong(
	result: ReturnType<typeof commandsFromNotes>,
	time: (tick: number) => number,
	tempos: { position: unknown; bpm: unknown }[],
	meters: { bar: unknown; numerator: unknown; denominator: unknown }[],
	names: unknown[],
	title: unknown
): SongSource {
	const song = result.song
	try {
		song.tempos = tempos
			.filter((tempo) => Number.isSafeInteger(tempo?.position) && Number(tempo.bpm) > 0)
			.map((tempo) => ({ time: time(tempo.position as number), bpm: Number(tempo.bpm) }))
		song.meters = meterTimes(
			song,
			meters.map((meter) => ({
				bar: Number(meter?.bar),
				numerator: Number(meter?.numerator),
				denominator: Number(meter?.denominator)
			}))
		)
	} catch {
		song.meters = []
	}
	if (typeof title === "string" && title.trim()) {
		song.name = title.trim().slice(0, 4096)
	}
	for (const track of song.tracks) {
		const index = track.channel < 10 ? track.channel - 1 : track.channel - 2
		if (typeof names[index] === "string" && (names[index] as string).trim()) {
			track.name = (names[index] as string).slice(0, 4096)
		}
	}
	return importedSong(song)
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
	const tempos = list(project.tempos).map((tempo) => ({
		position: tempo?.tickPosition,
		bpm: tempo?.bpm
	}))
	const time = projectTimeAxis(480, tempos)
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
	const result = commandsFromNotes(notes, file.name)
	return {
		...result,
		song: projectSong(
			result,
			time,
			tempos,
			list(project.timeSignatures ?? []).map((meter) => ({
				...meter,
				bar: meter?.measurePosition
			})),
			list(project.tracks).map((track) => track?.name),
			project.name
		)
	}
}

export async function importUSTXFile(file: File) {
	checkMusicFile(file)
	const { parse } = await import("yaml")
	const data = parse(await file.text(), { maxAliasCount: 0, schema: "core" })
	if (!data?.ustx_version || !Array.isArray(data.voice_parts)) {
		throw new Error("Expected an OpenUtau USTX project")
	}
	const tempos = list(data.tempos ?? [{ position: 0, bpm: data.bpm ?? 120 }]),
		resolution = data.resolution ?? 480
	const time = projectTimeAxis(resolution, tempos)
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
	const result = commandsFromNotes(notes, file.name)
	return {
		...result,
		song: projectSong(
			result,
			time,
			tempos,
			list(data.time_signatures ?? []).map((meter) => ({
				bar: meter?.bar_position,
				numerator: meter?.beat_per_bar,
				denominator: meter?.beat_unit
			})),
			list(data.tracks ?? []).map((track) => track?.track_name),
			data.name
		)
	}
}

export async function importSVPFile(file: File) {
	checkMusicFile(file)
	const data = parseMusicJSON(await file.text())
	if (!data?.time || !Array.isArray(data.tracks)) {
		throw new Error("Expected a Synthesizer V project")
	}
	const tempos = list(data.time.tempo ?? [])
	const time = projectTimeAxis(705600000, tempos)
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
	const result = commandsFromNotes(notes, file.name)
	return {
		...result,
		song: projectSong(
			result,
			time,
			tempos,
			list(data.time.meter ?? []).map((meter) => ({ ...meter, bar: meter?.index })),
			list(data.tracks).map((track) => track?.name),
			data.renderConfig?.filename
		)
	}
}