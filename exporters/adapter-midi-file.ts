import { midiBytes, songMIDI } from "../formats/song-midi"
import type { SongSource } from "../formats/song-source"
import { recordingMIDI } from "./adapter-interchange"
import type { NoteRecording } from "../formats/note-sequence"

export const createMIDIFileFromAudioEventRecording = async (
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> => {
	const midi = recordingMIDI(recording, timer)
	return new Blob([midiBytes(midi).buffer], { type: "audio/midi" })
}

/** Standard MIDI file with the song's tempo map, meters, key and track names */
export async function createMIDIFileFromSong(song: SongSource): Promise<Blob> {
	return new Blob([midiBytes(songMIDI(song)).buffer], { type: "audio/midi" })
}