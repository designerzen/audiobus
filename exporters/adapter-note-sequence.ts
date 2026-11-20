import { recordingNotes, exportTempo, type NoteRecording } from "../formats/note-sequence"

/** Magenta NoteSequence JSON; note times are seconds, independent of the tempo map. */
export function createNoteSequenceFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = exportTempo(timer)
	const notes = recordingNotes(recording).map((note) => ({
		pitch: note.number,
		velocity: note.velocity,
		startTime: note.start,
		endTime: note.start + note.duration,
		program: note.patch,
		instrument:
			note.channel === 10 ? 9 : note.channel < 10 ? note.channel - 1 : note.channel - 2,
		isDrum: note.channel === 10
	}))
	return (
		JSON.stringify(
			{
				notes,
				tempos: [{ time: 0, qpm: bpm }],
				ticksPerQuarter: 480,
				totalTime: notes.reduce((end, note) => Math.max(end, note.endTime), 0),
				sequenceMetadata: { title: recording.name }
			},
			null,
			2
		) + "\n"
	)
}