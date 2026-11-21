import AudioCommand from "../commands/audio-command"
import type { IAudioCommand } from "../commands/audio-command-interface"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND } from "../commands/commands"
import { recordingNotes, exportTempo, type NoteRecording, type SequenceNote } from "./note-sequence"

/** A song independent of the recorder. Times are seconds; beats are quarter notes. */
export interface SongSource {
	name: string
	/** Piecewise constant tempo map, starting at time 0 */
	tempos: { time: number; bpm: number }[]
	meters: { time: number; numerator: number; denominator: number }[]
	key?: { fifths: number; mode: "major" | "minor" }
	tracks: SongTrack[]
}
export interface SongTrack {
	name: string
	channel: number
	patch: number
	/** IO chain that plays the track, which identifies its timbre */
	chainId?: string
	source?: string
	notes: SequenceNote[]
	controllers?: { time: number; controller: number; value: number }[]
	/** Normalised bend, -1 to 1 */
	pitchBends?: { time: number; value: number }[]
}
export type SongMetadata = Partial<Omit<SongSource, "name" | "tracks">>
export interface SongBar {
	start: number
	end: number
	numerator: number
	denominator: number
}

const MAX_SECONDS = 86400
const finite = (value: number, min: number, max: number) =>
	typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
const integer = (value: number, min: number, max: number) =>
	Number.isInteger(value) && finite(value, min, max)
const byTime = <T extends { time: number }>(entries: T[]) =>
	entries.map((entry) => ({ ...entry })).sort((a, b) => a.time - b.time)
const validMeter = (meter: { numerator: number; denominator: number }) =>
	integer(meter.numerator, 1, 64) && [1, 2, 4, 8, 16, 32, 64].includes(meter.denominator)

/** Validated copy, never the caller's arrays. Tempo and meter changes at the same time keep the last. */
export function normalizeSong(song: SongSource): SongSource {
	if (
		typeof song?.name !== "string" ||
		song.name.length > 4096 ||
		!Array.isArray(song.tracks) ||
		song.tracks.length > 1024 ||
		song.tracks.reduce((count, track) => count + (track.notes?.length ?? 0), 0) > 100000
	) {
		throw new Error("Invalid song name or too many tracks or notes")
	}
	const timeline = <T extends { time: number }>(
		entries: T[] = [],
		fallback: T,
		valid: (entry: T) => boolean
	): T[] => {
		if (
			entries.length > 100000 ||
			entries.some((entry) => !finite(entry.time, 0, MAX_SECONDS) || !valid(entry))
		) {
			throw new Error("Invalid song tempo or meter")
		}
		return byTime([
			...new Map([fallback, ...entries].map((entry) => [entry.time, entry])).values()
		])
	}
	if (
		song.key &&
		(!integer(song.key.fifths, -7, 7) || !["major", "minor"].includes(song.key.mode))
	) {
		throw new Error("Invalid song key")
	}
	return {
		name: song.name,
		// A repeated tempo carries no information, unlike a repeated meter, which starts a bar.
		tempos: timeline(song.tempos, { time: 0, bpm: 120 }, (tempo) =>
			finite(tempo.bpm, 1, 10000)
		).filter((tempo, index, tempos) => !index || tempo.bpm !== tempos[index - 1].bpm),
		meters: timeline(song.meters, { time: 0, numerator: 4, denominator: 4 }, validMeter),
		...(song.key ? { key: { fifths: song.key.fifths, mode: song.key.mode } } : {}),
		tracks: song.tracks.map((track) => {
			if (
				typeof track.name !== "string" ||
				track.name.length > 4096 ||
				!integer(track.channel, 1, 16) ||
				!integer(track.patch, 0, 127)
			) {
				throw new Error("Invalid song track")
			}
			const notes = track.notes
				.map((note) => {
					if (
						!integer(note.number, 0, 127) ||
						!finite(note.velocity, 0, 127) ||
						!finite(note.start, 0, MAX_SECONDS) ||
						!finite(note.duration, Number.MIN_VALUE, MAX_SECONDS - note.start)
					) {
						throw new Error("Invalid song note")
					}
					return {
						...note,
						channel: track.channel,
						patch: track.patch,
						source: track.source ?? note.source,
						chainId: track.chainId ?? note.chainId
					}
				})
				.sort((a, b) => a.start - b.start)
			if (
				track.controllers?.some(
					(event) =>
						!finite(event.time, 0, MAX_SECONDS) ||
						!integer(event.controller, 0, 127) ||
						!integer(event.value, 0, 127)
				) ||
				track.pitchBends?.some(
					(event) => !finite(event.time, 0, MAX_SECONDS) || !finite(event.value, -1, 1)
				)
			) {
				throw new Error("Invalid song controller or pitch bend")
			}
			return {
				...track,
				notes,
				controllers: track.controllers && byTime(track.controllers),
				pitchBends: track.pitchBends && byTime(track.pitchBends)
			}
		})
	}
}

/** File metadata is optional, so drop invalid tempo, meter and key entries rather than failing an import */
export function importedSong(song: SongSource): SongSource {
	const key = song.key
	return normalizeSong({
		...song,
		tempos: (song.tempos ?? []).filter(
			(tempo) => finite(tempo.time, 0, MAX_SECONDS) && finite(tempo.bpm, 1, 10000)
		),
		meters: (song.meters ?? []).filter(
			(meter) => finite(meter.time, 0, MAX_SECONDS) && validMeter(meter)
		),
		key:
			key && integer(key.fifths, -7, 7) && ["major", "minor"].includes(key.mode)
				? key
				: undefined
	})
}

/** One track per source, chain, channel and program */
function groupNotes(notes: SequenceNote[], trackName: (note: SequenceNote) => string): SongTrack[] {
	const tracks = new Map<string, SongTrack>()
	for (const note of notes) {
		const id = JSON.stringify([note.source, note.chainId, note.channel, note.patch])
		let track = tracks.get(id)
		if (!track) {
			track = {
				name: trackName(note),
				channel: note.channel,
				patch: note.patch,
				source: note.source,
				chainId: note.chainId,
				notes: []
			}
			tracks.set(id, track)
		}
		track.notes.push(note)
	}
	return [...tracks.values()]
}

/** The recorder's notes from the first note onwards, at the timer's tempo in 4/4 */
export function songFromRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): SongSource {
	const notes = recordingNotes(recording, { sources: true, chains: true })
	// A source that plays on one channel names its track alone; otherwise the channel tells them apart
	const channels = new Map<string, Set<number>>()
	for (const note of notes) {
		if (note.source) {
			channels.set(note.source, (channels.get(note.source) ?? new Set()).add(note.channel))
		}
	}
	return normalizeSong({
		name: recording.name,
		tempos: [{ time: 0, bpm: exportTempo(timer) }],
		meters: [{ time: 0, numerator: 4, denominator: 4 }],
		tracks: groupNotes(notes, (note) =>
			note.source && channels.get(note.source)!.size === 1
				? note.source
				: `${note.source ?? recording.name} ${note.channel}`
		)
	})
}

/** Imported commands with any metadata the file provided; command times are kept, including leading silence */
export function songFromCommands(
	commands: IAudioCommand[],
	name: string,
	meta: SongMetadata = {}
): SongSource {
	const origin = commands
		.filter((e) => e.type === NOTE_ON && e.velocity > 0 && Number.isFinite(e.startAt))
		.reduce((min, e) => Math.min(min, e.startAt), Infinity)
	const duration = commands.reduce(
		(end, e) =>
			Math.max(
				end,
				Number.isFinite(e.startAt) ? e.startAt : 0,
				Number.isFinite(e.endAt) ? e.endAt : 0
			),
		0
	)
	const offset = Number.isFinite(origin) ? Math.max(0, origin) : 0
	const notes = recordingNotes(
		{ name, events: commands, duration },
		{ sources: true, chains: true }
	).map((note) => ({ ...note, start: note.start + offset }))
	// Importers label commands with a track name where the file has one, otherwise the file name.
	const tracks = groupNotes(notes, (note) =>
		note.source && note.source !== name ? note.source : `${name} ${note.channel}`
	)
	for (const track of tracks) {
		const events = commands.filter(
			(e) =>
				e.channel === track.channel &&
				e.from === track.source &&
				finite(e.startAt, 0, MAX_SECONDS)
		)
		// Imported controller data is optional, so skip malformed events rather than failing.
		track.controllers = events
			.filter(
				(e) =>
					e.type === CONTROL_CHANGE &&
					integer(e.number, 0, 127) &&
					integer(e.value, 0, 127)
			)
			.map((e) => ({ time: e.startAt, controller: e.number, value: e.value }))
		track.pitchBends = events
			.filter((e) => e.type === PITCH_BEND && integer(e.value, 0, 16383))
			.map((e) => ({ time: e.startAt, value: (e.value - 8192) / 8192 }))
	}
	return importedSong({
		name,
		tempos: meta.tempos ?? [],
		meters: meta.meters ?? [],
		key: meta.key,
		tracks
	})
}

export const songNotes = (song: SongSource): SequenceNote[] =>
	song.tracks
		.flatMap((track) =>
			track.notes.map((note) => ({
				...note,
				channel: track.channel,
				patch: track.patch,
				source: track.source ?? note.source,
				chainId: track.chainId ?? note.chainId
			}))
		)
		.sort((a, b) => a.start - b.start)

/** Monophonic voices, never mixing tracks */
export function songVoices(song: SongSource): SequenceNote[][] {
	return song.tracks.flatMap((track) => {
		const voices: SequenceNote[][] = []
		for (const note of songNotes({ ...song, tracks: [track] })) {
			let voice = voices.find((candidate) => {
				const last = candidate.at(-1)!
				return last.start + last.duration <= note.start + 1e-9
			})
			if (!voice) {
				voice = []
				voices.push(voice)
			}
			voice.push(note)
		}
		return voices
	})
}

/** Convert between seconds, quarter-note beats and ticks with a piecewise constant tempo map */
export function songTimeAxis(song: Pick<SongSource, "tempos">) {
	let beat = 0
	const points = song.tempos.map((point, index) => {
		const previous = song.tempos[index - 1]
		if (
			!finite(point.time, 0, MAX_SECONDS) ||
			!finite(point.bpm, 1, 10000) ||
			(!previous && point.time !== 0) ||
			(previous && point.time <= previous.time)
		) {
			throw new Error("Invalid song tempo map")
		}
		if (previous) {
			beat += ((point.time - previous.time) * previous.bpm) / 60
		}
		return { ...point, beat }
	})
	if (!points.length) {
		throw new Error("Song needs an initial tempo")
	}
	const locate = (value: number, field: "time" | "beat") => {
		if (!finite(value, 0, Number.MAX_SAFE_INTEGER)) {
			throw new Error("Invalid song position")
		}
		let low = 0,
			high = points.length
		while (low + 1 < high) {
			const middle = (low + high) >>> 1
			if (points[middle][field] <= value) {
				low = middle
			} else {
				high = middle
			}
		}
		return points[low]
	}
	const beats = (seconds: number) => {
		const point = locate(seconds, "time")
		return point.beat + ((seconds - point.time) * point.bpm) / 60
	}
	const seconds = (beats: number) => {
		const point = locate(beats, "beat")
		return point.time + ((beats - point.beat) * 60) / point.bpm
	}
	return {
		beats,
		seconds,
		ticks: (time: number, ppq = 480) => beats(time) * ppq,
		tickSeconds: (ticks: number, ppq = 480) => seconds(ticks / ppq)
	}
}

/** Seconds of meter changes stored by bar index, as vocal and notation projects do */
export function meterTimes(
	song: Pick<SongSource, "tempos">,
	meters: { bar: number; numerator: number; denominator: number }[]
): SongSource["meters"] {
	const axis = songTimeAxis(song),
		sorted = [...meters].sort((a, b) => a.bar - b.bar)
	let bar = 0,
		beat = 0,
		length = 4
	return sorted.map((meter) => {
		if (!integer(meter.bar, 0, 100000) || !validMeter(meter)) {
			throw new Error("Invalid meter")
		}
		beat += (meter.bar - bar) * length
		bar = meter.bar
		length = (meter.numerator * 4) / meter.denominator
		return {
			time: axis.seconds(beat),
			numerator: meter.numerator,
			denominator: meter.denominator
		}
	})
}

/** Bar boundaries in quarter notes; a meter change starts a new bar */
export function songBars(
	song: SongSource,
	endSeconds = Math.max(0, ...songNotes(song).map((note) => note.start + note.duration))
): SongBar[] {
	const axis = songTimeAxis(song),
		end = Math.max(axis.beats(endSeconds), 1e-9),
		bars: SongBar[] = []
	const meters = song.meters.length ? song.meters : [{ time: 0, numerator: 4, denominator: 4 }]
	for (const [index, meter] of meters.entries()) {
		const start = axis.beats(meter.time),
			next = meters[index + 1] ? axis.beats(meters[index + 1].time) : Infinity,
			length = (meter.numerator * 4) / meter.denominator
		for (let at = start; at < Math.min(next, end) - 1e-9; at += length) {
			if (bars.length >= 100000) {
				throw new Error("Song has too many bars")
			}
			bars.push({
				start: at,
				end: Math.min(at + length, next),
				numerator: meter.numerator,
				denominator: meter.denominator
			})
		}
	}
	return bars
}

/** Commands for recording-based exporters, keeping the song for those that read its metadata */
export function recordingFromSong(song: SongSource): NoteRecording & { song: SongSource } {
	const events = songNotes(song).flatMap((note, index) => {
		const common = {
			number: note.number,
			channel: note.channel,
			patch: note.patch,
			from: note.source,
			chainId: note.chainId,
			inputId: String(index)
		}
		return [
			Object.assign(new AudioCommand(), common, {
				type: NOTE_ON,
				startAt: note.start,
				endAt: note.start + note.duration,
				velocity: note.velocity
			}),
			Object.assign(new AudioCommand(), common, {
				type: NOTE_OFF,
				startAt: note.start + note.duration,
				velocity: 0
			})
		]
	})
	return {
		name: song.name,
		duration: events.reduce((end, e) => Math.max(end, e.startAt), 0),
		events,
		song
	}
}