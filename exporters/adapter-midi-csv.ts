import {
	normalizeSong,
	songFromRecording,
	songTimeAxis,
	type SongSource
} from "../formats/song-source"
import { type NoteRecording } from "../formats/note-sequence"

/** Standard MIDICSV (PPQ timing), exporting recorded notes and their programs at the timer's tempo. */
export function createMIDICSVFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	return createMIDICSVFromSong(recording.song ?? songFromRecording(recording, timer))
}
/** MIDICSV with the tempo map, meters, key and track names */
export function createMIDICSVFromSong(source: SongSource): string {
	const song = normalizeSong(source)
	const ppq = 480,
		axis = songTimeAxis(song)
	const quote = (text: string) => text.replace(/[\r\n]/g, " ").replace(/"/g, '""')
	const meta = [
		...song.tempos.map((t) => ({
			tick: Math.round(axis.ticks(t.time, ppq)),
			text: `Tempo, ${Math.round(60000000 / t.bpm)}`
		})),
		...song.meters.map((m) => ({
			tick: Math.round(axis.ticks(m.time, ppq)),
			text: `Time_signature, ${m.numerator}, ${Math.log2(m.denominator)}, 24, 8`
		})),
		...(song.key
			? [{ tick: 0, text: `Key_signature, ${song.key.fifths}, "${song.key.mode}"` }]
			: [])
	].sort((a, b) => a.tick - b.tick)
	const rows = [
		`0, 0, Header, 1, ${song.tracks.length + 1}, ${ppq}`,
		"1, 0, Start_track",
		`1, 0, Title_t, "${quote(song.name)}"`,
		...meta.map((e) => `1, ${e.tick}, ${e.text}`),
		`1, ${meta.at(-1)?.tick ?? 0}, End_track`
	]
	let track = 1
	for (const part of song.tracks) {
		track++
		rows.push(
			`${track}, 0, Start_track`,
			`${track}, 0, Title_t, "${quote(part.name)}"`,
			`${track}, 0, Program_c, ${part.channel - 1}, ${part.patch}`
		)
		const events = part.notes
			.flatMap((note) => [
				{
					tick: Math.round(axis.ticks(note.start, ppq)),
					type: "Note_on_c",
					channel: note.channel - 1,
					number: note.number,
					velocity: note.velocity
				},
				{
					tick: Math.max(
						Math.round(axis.ticks(note.start, ppq)) + 1,
						Math.round(axis.ticks(note.start + note.duration, ppq))
					),
					type: "Note_off_c",
					channel: note.channel - 1,
					number: note.number,
					velocity: 0
				}
			])
			.sort((a, b) => a.tick - b.tick || (a.type === "Note_off_c" ? -1 : 1))
		for (const e of events) {
			rows.push(`${track}, ${e.tick}, ${e.type}, ${e.channel}, ${e.number}, ${e.velocity}`)
		}
		rows.push(`${track}, ${events.at(-1)?.tick ?? 0}, End_track`)
	}
	return [...rows, "0, 0, End_of_file"].join("\n") + "\n"
}