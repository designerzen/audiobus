import { songFromRecording, songNotes, type SongSource } from "../formats/song-source"
import { type NoteRecording } from "../formats/note-sequence"
import { MED_SPEC, writeMED } from "../formats/med/med-exporter"
import { buildTrackerSong } from "../formats/tracker/tracker-grid"
import { IT_SPEC, writeIT } from "../formats/tracker/it-writer"
import { MOD_SPEC, writeMOD } from "../formats/tracker/mod-writer"
import { S3M_SPEC, writeS3M } from "../formats/tracker/s3m-writer"
import { XM_SPEC, writeXM } from "../formats/tracker/xm-writer"
import {
	STM_SPEC,
	AMF_SPEC,
	PTM_SPEC,
	writeSTM,
	writeAMF,
	writePTM
} from "../formats/tracker/additional-writers"
import {
	MTM_SPEC,
	DSM_SPEC,
	ULT_SPEC,
	C669_SPEC,
	OKT_SPEC,
	writeMTM,
	writeDSM,
	writeULT,
	write669,
	writeOKT
} from "../formats/tracker/legacy-writers"
import {
	TRACKER_EXPORT_FORMATS,
	type TrackerExportId,
	type TrackerExportOptions,
	type TrackerFormatSpec,
	type TrackerSong
} from "../formats/tracker/tracker-types"

export { TRACKER_EXPORT_FORMATS }
export type {
	TrackerExportId,
	TrackerExportOptions,
	TrackerSample,
	TrackerSampleMap
} from "../formats/tracker/tracker-types"
export { trackerInstrumentKey } from "../formats/tracker/tracker-types"

const WRITERS: Record<
	TrackerExportId,
	{ spec: TrackerFormatSpec; write: (song: TrackerSong) => Uint8Array<ArrayBuffer> }
> = {
	med: { spec: MED_SPEC, write: writeMED },
	mod: { spec: MOD_SPEC, write: writeMOD },
	xm: { spec: XM_SPEC, write: writeXM },
	s3m: { spec: S3M_SPEC, write: writeS3M },
	it: { spec: IT_SPEC, write: writeIT },
	mtm: { spec: MTM_SPEC, write: writeMTM },
	dsm: { spec: DSM_SPEC, write: writeDSM },
	ult: { spec: ULT_SPEC, write: writeULT },
	"669": { spec: C669_SPEC, write: write669 },
	okt: { spec: OKT_SPEC, write: writeOKT },
	stm: { spec: STM_SPEC, write: writeSTM },
	amf: { spec: AMF_SPEC, write: writeAMF },
	ptm: { spec: PTM_SPEC, write: writePTM }
}

/** Module bytes for a recording; each instrument that played gets one embedded sample.
 * Throws a readable error when the recording exceeds what the format can hold.
 */
export function createTrackerModule(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	format: TrackerExportId,
	options: TrackerExportOptions = {}
): Uint8Array<ArrayBuffer> {
	return createTrackerModuleFromSong(
		recording.song ?? songFromRecording(recording, timer),
		format,
		options
	)
}
export function createTrackerModuleFromSong(
	source: SongSource,
	format: TrackerExportId,
	options: TrackerExportOptions = {}
): Uint8Array<ArrayBuffer> {
	const writer = WRITERS[format]
	if (!writer) {
		throw new Error(`Unknown tracker format: ${format}`)
	}
	const bpm = source.tempos[0].bpm
	const notes = songNotes(source)
	const song = buildTrackerSong(notes, bpm, writer.spec, source.name, options.samples)
	return writer.write(song)
}

/** Tracker module as a downloadable file */
export async function exportTrackerRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	format: TrackerExportId,
	options: TrackerExportOptions = {}
): Promise<Blob> {
	return new Blob([createTrackerModule(recording, timer, format, options)], {
		type: "application/octet-stream"
	})
}
export async function exportTrackerSong(
	song: SongSource,
	format: TrackerExportId,
	options: TrackerExportOptions = {}
): Promise<Blob> {
	return new Blob([createTrackerModuleFromSong(song, format, options)], {
		type: "application/octet-stream"
	})
}