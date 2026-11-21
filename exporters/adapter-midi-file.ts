import { recordingMIDI } from "./adapter-interchange"
import type { NoteRecording } from "../formats/note-sequence"

export const createMIDIFileFromAudioEventRecording = async (
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> => {
	const midi = recordingMIDI(recording, timer)
	return new Blob([Uint8Array.from(midi.toArray()).buffer], { type: "audio/midi" })
}
