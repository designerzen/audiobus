import type { NoteRecording } from "../formats/note-sequence"
import { INTERCHANGE_EXPORT_FORMATS } from "./adapter-interchange"
import { TRACKER_EXPORT_FORMATS, type TrackerSampleMap } from "../formats/tracker/tracker-types"

export interface ExportFormat {
	readonly id: string
	readonly label: string
	readonly extension: string
	readonly mime: string
	readonly kind: "notes" | "score" | "project" | "tracker" | "text"
	readonly polyphony: "mono" | "poly"
	readonly export: (
		recording: NoteRecording,
		timer: { readonly BPM: number },
		options?: { samples?: TrackerSampleMap }
	) => Promise<Blob>
}

export const EXPORT_FORMATS: readonly ExportFormat[] = [
	{
		id: "midi",
		label: "MIDI file",
		extension: "mid",
		mime: "audio/midi",
		kind: "notes",
		polyphony: "poly",
		export: async (recording, timer) =>
			(await import("./adapter-midi-file.ts")).createMIDIFileFromAudioEventRecording(
				recording,
				timer
			)
	},
	{
		id: "midi-markdown",
		label: "MIDI Markdown",
		extension: "md",
		mime: "text/markdown;charset=utf-8",
		kind: "text",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(
						await import("./adapter-midi-markdown.ts")
					).createMIDIMarkdownFromAudioEventRecording(recording, timer)
				],
				{ type: "text/markdown;charset=utf-8" }
			)
	},
	{
		id: "musicxml",
		label: "MusicXML score",
		extension: "musicxml",
		mime: "application/vnd.recordare.musicxml+xml",
		kind: "score",
		polyphony: "poly",
		export: async (recording, timer) =>
			(await import("./adapter-musicxml.ts")).createMusicXMLFromAudioEventRecording(
				recording,
				timer
			)
	},
	{
		id: "mxl",
		label: "Compressed MusicXML",
		extension: "mxl",
		mime: "application/vnd.recordare.musicxml",
		kind: "score",
		polyphony: "poly",
		export: async (recording, timer) =>
			(await import("./adapter-musicxml.ts")).createMXLFromAudioEventRecording(
				recording,
				timer
			)
	},
	{
		id: "dawproject",
		label: "DAWproject",
		extension: "dawProject",
		mime: "application/zip",
		kind: "project",
		polyphony: "poly",
		export: async (recording, timer) =>
			(await import("./adapter-dawproject.ts")).createDawProjectFromAudioEventRecording(
				recording,
				timer
			)
	},
	{
		id: "abc",
		label: "ABC notation",
		extension: "abc",
		mime: "text/vnd.abc;charset=utf-8",
		kind: "score",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(await import("./adapter-abc.ts")).createABCFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/vnd.abc;charset=utf-8" }
			)
	},
	{
		id: "midi-csv",
		label: "MIDI CSV",
		extension: "csv",
		mime: "text/csv;charset=utf-8",
		kind: "notes",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(await import("./adapter-midi-csv.ts")).createMIDICSVFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/csv;charset=utf-8" }
			)
	},
	{
		id: "mml",
		label: "Core MML",
		extension: "mml",
		mime: "text/plain;charset=utf-8",
		kind: "text",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(await import("./adapter-mml.ts")).createMMLFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/plain;charset=utf-8" }
			)
	},
	{
		id: "rtttl",
		label: "RTTTL ringtone (single voice)",
		extension: "rtttl",
		mime: "text/plain;charset=utf-8",
		kind: "text",
		polyphony: "mono",
		export: async (recording, timer) =>
			new Blob(
				[
					(await import("./adapter-rtttl.ts")).createRTTTLFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/plain;charset=utf-8" }
			)
	},
	{
		id: "lilypond",
		label: "LilyPond score",
		extension: "ly",
		mime: "text/x-lilypond;charset=utf-8",
		kind: "score",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(await import("./adapter-lilypond.ts")).createLilyPondFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/x-lilypond;charset=utf-8" }
			)
	},
	{
		id: "notesequence",
		label: "Magenta NoteSequence",
		extension: "notes.json",
		mime: "application/json",
		kind: "notes",
		polyphony: "poly",
		export: async (recording, timer) =>
			new Blob(
				[
					(
						await import("./adapter-note-sequence.ts")
					).createNoteSequenceFromAudioEventRecording(recording, timer)
				],
				{ type: "application/json" }
			)
	},
	...INTERCHANGE_EXPORT_FORMATS.map(
		(format): ExportFormat => ({
			...format,
			mime:
				(
					{
						"tone-json": "application/json",
						jams: "application/json",
						svl: "application/xml",
						rmid: "audio/rmid",
						"guitar-pro": "application/octet-stream",
						"lmms-compressed": "application/octet-stream",
						lmms: "application/xml",
						svp: "application/json",
						ustx: "application/yaml",
						ufdata: "application/json"
					} as Record<string, string>
				)[format.id] ?? "text/plain;charset=utf-8",
			kind: ["guitar-pro", "alphatex"].includes(format.id)
				? "score"
				: ["svp", "ustx", "ufdata", "lmms", "lmms-compressed", "reaper"].includes(format.id)
					? "project"
					: "notes",
			polyphony: format.id === "ust" ? "mono" : "poly",
			export: async (recording, timer) =>
				(await import("./adapter-interchange.ts")).exportInterchangeRecording(
					recording,
					timer,
					format.id
				)
		})
	),
	...([false, true] as const).map(
		(compressed): ExportFormat => ({
			id: compressed ? "mscz" : "mscx",
			label: compressed ? "Compressed MuseScore 4 score" : "MuseScore 4 score",
			extension: compressed ? "mscz" : "mscx",
			mime: compressed ? "application/x-musescore" : "application/x-musescore+xml",
			kind: "score",
			polyphony: "poly",
			export: async (recording, timer) =>
				(await import("./adapter-musescore.ts")).createMuseScoreFromAudioEventRecording(
					recording,
					timer,
					compressed
				)
		})
	),
	...TRACKER_EXPORT_FORMATS.map(
		(format): ExportFormat => ({
			...format,
			mime: "application/octet-stream",
			kind: "tracker",
			polyphony: "poly",
			export: async (recording, timer, options) =>
				format.id === "med"
					? new Blob(
							[
								await (
									await import("./adapter-med-file.ts")
								).createMEDFileFromAudioEventRecording(recording, timer, options)
							],
							{ type: "application/octet-stream" }
						)
					: (await import("./adapter-tracker.ts")).exportTrackerRecording(
							recording,
							timer,
							format.id,
							options
						)
		})
	)
]

export const getExportFormat = (id: string): ExportFormat | undefined =>
	EXPORT_FORMATS.find((format) => format.id === id)