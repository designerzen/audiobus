/**
 * MED File Export Adapter
 * Converts a note recording to an OctaMED module with embedded instrument samples
 */

import type { NoteRecording } from "../formats/note-sequence.ts"
import type { SongSource } from "../formats/song-source.ts"
import type { TrackerExportOptions } from "../formats/tracker/tracker-types.ts"
import { createTrackerModule, createTrackerModuleFromSong } from "./adapter-tracker.ts"

/**
 * Trigger MED file download in browser
 */
export const saveMEDToLocalFileSystem = (buffer: ArrayBuffer, fileName: string) => {
	const blob = new Blob([buffer], { type: "application/octet-stream" })
	const url = URL.createObjectURL(blob)

	const link = document.createElement("a")
	link.href = url
	link.download = `${fileName}.med`

	document.body.appendChild(link)
	link.click()

	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

/**
 * Convert a recording to MED format
 * @param recording - Recorded audio events
 * @param timer - Timer with BPM info
 * @param options - Captured instrument timbres; missing ones are synthesised
 * @returns MED file buffer
 */
export const createMEDFileFromAudioEventRecording = async (
	recording: NoteRecording,
	timer: { readonly BPM: number },
	options?: TrackerExportOptions
): Promise<ArrayBuffer> => {
	const bytes = createTrackerModule(recording, timer, "med", options)
	return bytes.buffer
}

/**
 * Synchronous wrapper for event handler
 */
export const createAndDownloadMEDFile = async (
	recording: NoteRecording,
	timer: { readonly BPM: number },
	options?: TrackerExportOptions
): Promise<void> => {
	const buffer = await createMEDFileFromAudioEventRecording(recording, timer, options)
	saveMEDToLocalFileSystem(buffer, recording.name)
}

/** MED module from a song, using its first tempo */
export async function createMEDFileFromSong(
	song: SongSource,
	options?: TrackerExportOptions
): Promise<ArrayBuffer> {
	return createTrackerModuleFromSong(song, "med", options).buffer
}