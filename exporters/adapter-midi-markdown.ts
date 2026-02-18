import type { RecorderAudioEvent } from '../audio-event-recorder.ts'
import type AudioEvent from '../audio-event.ts'
import type Timer from '../timing/timer.ts'
import { NOTE_ON } from '../commands.ts'

/**
 * Generates a Markdown representation of MIDI events with timing and note information
 * @param recording - The audio event recording data
 * @param timer - The timer instance containing BPM and timing information
 * @returns Markdown formatted string
 */
export const createMIDIMarkdownFromAudioEventRecording = (
	recording: RecorderAudioEvent,
	timer: Timer
): string => {
	const BPM = timer.BPM
	const data: AudioEvent[] = recording.exportData()
	const duration: number = recording.duration

	// Filter only NOTE_ON events
	const notes = data.filter((event) => event.type === NOTE_ON)

	// Build markdown
	let markdown = `# ${recording.name}\n\n`
	markdown += `**Tempo:** ${BPM} BPM\n`
	markdown += `**Duration:** ${formatDuration(duration)}\n`
	markdown += `**Total Notes:** ${notes.length}\n\n`

	markdown += `## Notes\n\n`
	markdown += `| Time | Duration | Note | MIDI # |\n`
	markdown += `|------|----------|------|--------|\n`

	notes.forEach((note) => {
		const timeStr = formatTime(note.startAt)
		const durationStr = formatTime(note.duration)
		const noteName = midiNumberToNoteName(note.noteNumber)
		markdown += `| ${timeStr} | ${durationStr} | ${noteName} | ${note.noteNumber} |\n`
	})

	return markdown
}

/**
 * Saves markdown content to local file system as download
 */
export const saveMarkdownToLocalFileSystem = (
	content: string,
	fileName: string
) => {
	const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${fileName}.md`

	document.body.appendChild(a)
	a.click()

	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

/**
 * Format time in seconds to MM:SS.ms format
 */
function formatTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	const secs = seconds % 60
	return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`
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
	const noteNames = [
		'C',
		'C#',
		'D',
		'D#',
		'E',
		'F',
		'F#',
		'G',
		'G#',
		'A',
		'A#',
		'B'
	]
	const octave = Math.floor(midiNumber / 12) - 1
	const noteIndex = midiNumber % 12
	return `${noteNames[noteIndex]}${octave}`
}


