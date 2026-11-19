import {
	recordingNotes,
	exportTempo,
	type NoteRecording,
	type SequenceNote
} from "../formats/note-sequence"

/** Standard MIDICSV (PPQ timing), exporting recorded notes and their programs. */
export function createMIDICSVFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = exportTempo(timer),
		ppq = 480
	const groups = new Map<string, SequenceNote[]>()
	for (const note of recordingNotes(recording)) {
		const key = `${note.channel}:${note.patch}`
		const notes = groups.get(key) ?? []
		notes.push(note)
		groups.set(key, notes)
	}
	const title = recording.name.replace(/[\r\n]/g, " ").replace(/"/g, '""')
	const rows = [
		`0, 0, Header, 1, ${groups.size + 1}, ${ppq}`,
		"1, 0, Start_track",
		`1, 0, Title_t, "${title}"`,
		`1, 0, Tempo, ${Math.round(60000000 / bpm)}`,
		"1, 0, End_track"
	]
	let track = 1
	for (const notes of groups.values()) {
		track++
		const first = notes[0]
		rows.push(
			`${track}, 0, Start_track`,
			`${track}, 0, Program_c, ${first.channel - 1}, ${first.patch}`
		)
		const events = notes
			.flatMap((note) => [
				{
					tick: Math.round(((note.start * bpm) / 60) * ppq),
					type: "Note_on_c",
					channel: note.channel - 1,
					number: note.number,
					velocity: note.velocity
				},
				{
					tick: Math.max(
						Math.round(((note.start * bpm) / 60) * ppq) + 1,
						Math.round((((note.start + note.duration) * bpm) / 60) * ppq)
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