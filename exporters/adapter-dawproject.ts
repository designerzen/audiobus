import { zipSync, strToU8 } from "fflate"
import {
	recordingNotes,
	exportTempo,
	escapeXML,
	type NoteRecording
} from "../formats/note-sequence"

/** Standard DAWproject ZIP/XML archive containing the recorded note arrangement. */
export async function createDawProjectFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> {
	const bpm = exportTempo(timer),
		notes = recordingNotes(recording)
	const channels = [...new Set(notes.map((note) => note.channel))]
	const tracks = channels
		.map(
			(channel) =>
				`<Track id="track-${channel}" name="Channel ${channel}" contentType="notes" loaded="true"><Channel id="channel-${channel}" role="regular" audioChannels="2" destination="master"/></Track>`
		)
		.join("")
	const lanes = channels
		.map(
			(channel) =>
				`<Lanes track="track-${channel}"><Notes timeUnit="seconds">${notes
					.filter((note) => note.channel === channel)
					.map(
						(note) =>
							`<Note time="${note.start}" duration="${note.duration}" key="${note.number}" channel="${note.channel - 1}" vel="${note.velocity / 127}"/>`
					)
					.join("")}</Notes></Lanes>`
		)
		.join("")
	const xml = `<?xml version="1.0" encoding="UTF-8"?><Project version="1.0"><Application name="Harmoneasy" version="1.0"/><Transport><Tempo id="tempo" unit="bpm" value="${bpm}"/></Transport><Structure>${tracks}<Track id="master-track" name="Master"><Channel id="master" role="master" audioChannels="2"/></Track></Structure><Arrangement><Lanes timeUnit="seconds">${lanes}</Lanes></Arrangement></Project>`
	const metadata = `<?xml version="1.0" encoding="UTF-8"?><MetaData><Title>${escapeXML(recording.name)}</Title></MetaData>`
	const bytes = zipSync({ "project.xml": strToU8(xml), "metadata.xml": strToU8(metadata) })
	return new Blob([Uint8Array.from(bytes).buffer], { type: "application/zip" })
}