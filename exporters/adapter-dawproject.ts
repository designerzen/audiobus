import { zipSync, strToU8 } from "fflate"
import { escapeXML, type NoteRecording } from "../formats/note-sequence"
import { normalizeSong, songFromRecording, type SongSource } from "../formats/song-source"

/** DAWproject archive from the recording at the timer's tempo */
export function createDawProjectFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> {
	return createDawProjectFromSong(recording.song ?? songFromRecording(recording, timer))
}
/** DAWproject archive with named tracks, tempo and meter automation; times are seconds. */
export async function createDawProjectFromSong(source: SongSource): Promise<Blob> {
	const song = normalizeSong(source)
	const tracks = song.tracks
		.map(
			(track, i) =>
				`<Track id="track-${i}" name="${escapeXML(track.name)}" contentType="notes" loaded="true"><Channel id="channel-${i}" role="regular" audioChannels="2" destination="master"/></Track>`
		)
		.join("")
	const lanes = song.tracks
		.map(
			(track, i) =>
				`<Lanes track="track-${i}"><Notes timeUnit="seconds">${track.notes.map((note) => `<Note time="${note.start}" duration="${note.duration}" key="${note.number}" channel="${note.channel - 1}" vel="${note.velocity / 127}"/>`).join("")}</Notes></Lanes>`
		)
		.join("")
	const tempo = `<TempoAutomation timeUnit="seconds" unit="bpm"><Target parameter="tempo"/>${song.tempos.map((t) => `<RealPoint time="${t.time}" value="${t.bpm}" interpolation="hold"/>`).join("")}</TempoAutomation>`
	const meter = `<TimeSignatureAutomation timeUnit="seconds"><Target parameter="meter"/>${song.meters.map((m) => `<TimeSignaturePoint time="${m.time}" numerator="${m.numerator}" denominator="${m.denominator}"/>`).join("")}</TimeSignatureAutomation>`
	const xml = `<?xml version="1.0" encoding="UTF-8"?><Project version="1.0"><Application name="Harmoneasy" version="1.0"/><Transport><Tempo id="tempo" unit="bpm" value="${song.tempos[0].bpm}"/><TimeSignature id="meter" numerator="${song.meters[0].numerator}" denominator="${song.meters[0].denominator}"/></Transport><Structure>${tracks}<Track id="master-track" name="Master"><Channel id="master" role="master" audioChannels="2"/></Track></Structure><Arrangement>${meter}${tempo}<Lanes timeUnit="seconds">${lanes}</Lanes></Arrangement></Project>`
	const metadata = `<?xml version="1.0" encoding="UTF-8"?><MetaData><Title>${escapeXML(song.name)}</Title></MetaData>`
	const bytes = zipSync({ "project.xml": strToU8(xml), "metadata.xml": strToU8(metadata) })
	return new Blob([Uint8Array.from(bytes).buffer], { type: "application/zip" })
}