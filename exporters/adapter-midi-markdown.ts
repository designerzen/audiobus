import { recordingNotes, type NoteRecording } from "../formats/note-sequence"

/**
 * Generates a Markdown representation of MIDI events with timing and note information
 * @param recording - The audio event recording data
 * @param timer - The timer instance containing BPM and timing information
 * @returns Markdown formatted string
 */
export const createMIDIMarkdownFromAudioEventRecording = (
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string => {
	const BPM = timer.BPM
	const duration: number = recording.duration

	const notes = recordingNotes(recording)

	// Build markdown
	let markdown = `# ${recording.name}\n\n`
	markdown += `**Tempo:** ${BPM} BPM\n`
	markdown += `**Duration:** ${formatDuration(duration)}\n`
	markdown += `**Total Notes:** ${notes.length}\n\n`

	markdown += `## Notes\n\n`
	markdown += `| Time | Duration | Note | MIDI # |\n`
	markdown += `|------|----------|------|--------|\n`

	notes.forEach((note) => {
		const timeStr = formatTime(note.start)
		const durationStr = formatTime(note.duration)
		const noteName = midiNumberToNoteName(note.number)
		markdown += `| ${timeStr} | ${durationStr} | ${noteName} | ${note.number} |\n`
	})

	return markdown
}

/**
 * Format time in seconds to MM:SS.ms format
 */
function formatTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	const secs = seconds % 60
	return `${minutes}:${secs.toFixed(2).padStart(5, "0")}`
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	const secs = Math.round(seconds % 60)
	if (minutes > 0) {
		return `${minutes}m ${secs}s`
	}
	return `${secs}s`
}

/**
 * Convert MIDI note number to note name (e.g., 60 -> C4)
 */
function midiNumberToNoteName(midiNumber: number): string {
	const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
	const octave = Math.floor(midiNumber / 12) - 1
	const noteIndex = midiNumber % 12
	return `${noteNames[noteIndex]}${octave}`
}