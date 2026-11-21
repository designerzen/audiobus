import { Midi } from "@tonejs/midi"
import {
	recordingNotes,
	recordingVoices,
	exportTempo,
	escapeXML,
	type NoteRecording
} from "../formats/note-sequence"

export const INTERCHANGE_EXPORT_FORMATS = [
	{ id: "tone-json", label: "Tone.js MIDI JSON", extension: "tone.json" },
	{ id: "jams", label: "JAMS note annotations", extension: "jams" },
	{ id: "ust", label: "UTAU melody (single voice)", extension: "ust" },
	{ id: "svl", label: "Sonic Visualiser note layer", extension: "svl" },
	{ id: "rmid", label: "RIFF MIDI", extension: "rmi" },
	{ id: "guitar-pro", label: "Guitar Pro 7", extension: "gp" },
	{ id: "alphatex", label: "alphaTex score", extension: "atex" },
	{ id: "svp", label: "Synthesizer V note project", extension: "svp" },
	{ id: "ustx", label: "OpenUtau note project", extension: "ustx" },
	{ id: "ufdata", label: "UtaFormatix data", extension: "ufdata" },
	{ id: "lmms", label: "LMMS note project", extension: "mmp" },
	{ id: "lmms-compressed", label: "Compressed LMMS note project", extension: "mmpz" },
	{ id: "reaper", label: "REAPER MIDI project", extension: "rpp" }
] as const
export type InterchangeExportId = (typeof INTERCHANGE_EXPORT_FORMATS)[number]["id"]

export function recordingMIDI(recording: NoteRecording, timer: { readonly BPM: number }) {
	const midi = new Midi()
	midi.header.name = recording.name
	midi.header.setTempo(exportTempo(timer))
	const tracks = new Map<string, ReturnType<Midi["addTrack"]>>()
	for (const note of recordingNotes(recording, { sources: true })) {
		const key = `${note.channel}:${note.patch}`
		let track = tracks.get(key)
		if (!track) {
			track = midi.addTrack()
			track.channel = note.channel - 1
			track.instrument.number = note.patch
			track.name = `${note.source ?? recording.name} ${note.channel}`
			tracks.set(key, track)
		}
		track.addNote({
			midi: note.number,
			time: note.start,
			duration: note.duration,
			velocity: note.velocity / 127
		})
	}
	return midi
}

export function createToneJSONFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	return JSON.stringify(recordingMIDI(recording, timer).toJSON(), null, 2) + "\n"
}

export function createJAMSFromAudioEventRecording(recording: NoteRecording): string {
	const notes = recordingNotes(recording)
	const groups = new Map<string, typeof notes>()
	for (const note of notes) {
		const key = `${note.channel}:${note.patch}`
		const group = groups.get(key) ?? []
		group.push(note)
		groups.set(key, group)
	}
	const duration = notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0)
	return (
		JSON.stringify(
			{
				file_metadata: {
					title: recording.name,
					artist: "",
					release: "",
					duration,
					identifiers: {},
					jams_version: "0.3.5"
				},
				annotations: [...groups.values()].map((group) => ({
					namespace: "note_midi",
					time: 0,
					duration,
					annotation_metadata: {
						curator: { name: "", email: "" },
						annotator: {},
						version: "1.0",
						corpus: "",
						annotation_tools: "Harmoneasy",
						annotation_rules: "",
						validation: "",
						data_source: "recording"
					},
					data: group.map((note) => ({
						time: note.start,
						duration: note.duration,
						value: note.number,
						confidence: null
					})),
					sandbox: { harmoneasy: { channel: group[0].channel, program: group[0].patch } }
				})),
				sandbox: {}
			},
			null,
			2
		) + "\n"
	)
}

export function createUSTFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = exportTempo(timer),
		notes = recordingNotes(recording)
	const lines = [
		"[#VERSION]",
		"UST Version1.2",
		"Charset=UTF-8",
		"[#SETTING]",
		`Tempo=${bpm}`,
		"Tracks=1",
		`ProjectName=${recording.name.replace(/[\r\n]/g, " ")}`,
		"Mode2=True"
	]
	let cursor = 0,
		section = 0,
		previousEnd = 0
	const write = (length: number, pitch: number, lyric: string, intensity = 100) => {
		if (section >= 100000) {
			throw new Error("UST export exceeds 100,000 sections")
		}
		lines.push(
			`[#${String(section++).padStart(4, "0")}]`,
			`Length=${length}`,
			`Lyric=${lyric}`,
			`NoteNum=${pitch}`,
			`Intensity=${intensity}`
		)
	}
	for (const note of notes) {
		if (note.start < previousEnd - 1e-9) {
			throw new Error(
				"UST supports a single melody. Export overlapping notes as MIDI, MusicXML or Guitar Pro."
			)
		}
		const start = Math.round(((note.start * bpm) / 60) * 480)
		const end = Math.max(
			start + 1,
			Math.round((((note.start + note.duration) * bpm) / 60) * 480)
		)
		if (start > cursor) {
			write(start - cursor, 60, "R")
		}
		write(end - start, note.number, "a", (note.velocity / 127) * 100)
		cursor = end
		previousEnd = note.start + note.duration
	}
	lines.push("[#TRACKEND]")
	return lines.join("\r\n") + "\r\n"
}

export function createSVLFromAudioEventRecording(recording: NoteRecording): string {
	const points = recordingNotes(recording)
		.map(
			(note) =>
				`<point frame="${Math.round(note.start * 48000)}" value="${note.number}" duration="${Math.max(1, Math.round(note.duration * 48000))}" level="${note.velocity / 127}" label=""/>`
		)
		.join("\n")
	return `<?xml version="1.0" encoding="UTF-8"?>\n<sv><data><model id="1" name="${escapeXML(recording.name)}" sampleRate="48000" type="sparse" dimensions="3" resolution="1" notifyOnAdd="true" dataset="2" subtype="note" valueQuantization="1" minimum="0" maximum="127" units="MIDI Pitch"/><dataset id="2" dimensions="3">${points}</dataset></data><display><layer id="3" type="notes" model="1" name="${escapeXML(recording.name)}"/></display></sv>\n`
}

export function createRMIDFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Uint8Array<ArrayBuffer> {
	const midi = recordingMIDI(recording, timer).toArray()
	const bytes = new Uint8Array(20 + midi.length + (midi.length % 2)),
		view = new DataView(bytes.buffer)
	bytes.set(new TextEncoder().encode("RIFF"))
	view.setUint32(4, bytes.length - 8, true)
	bytes.set(new TextEncoder().encode("RMIDdata"), 8)
	view.setUint32(16, midi.length, true)
	bytes.set(midi, 20)
	return bytes
}

/** Measured notation with explicit rests and ties on a 1/64-note grid.
 * Unlike a performance score, this avoids ambiguous forward/backup durations in score editors.
 */
function notationXML(recording: NoteRecording, bpm: number): string {
	const voices = recordingVoices(recording)
	if (!voices.length) {
		throw new Error("Record some notes before exporting a score")
	}
	if (voices.length > 128) {
		throw new Error("Notation export supports at most 128 voices")
	}
	const scale = (bpm / 60) * 16
	const parts = voices
		.map((notes, index) => {
			const quantized = notes.map((note) => {
				const start = Math.round(note.start * scale)
				return {
					...note,
					start,
					end: Math.max(start + 1, Math.round((note.start + note.duration) * scale))
				}
			})
			const end = quantized.at(-1)!.end
			if (end > 100000) {
				throw new Error("Score is too long for notation export")
			}
			const measures: string[][] = [[]]
			let cursor = 0
			const writeSpan = (until: number, note?: (typeof quantized)[number]) => {
				const start = cursor
				while (cursor < until) {
					if (cursor && cursor % 64 === 0) {
						measures.push([])
					}
					const available = Math.min(until - cursor, 64 - (cursor % 64))
					const size = 2 ** Math.floor(Math.log2(available))
					const type = (
						{
							64: "whole",
							32: "half",
							16: "quarter",
							8: "eighth",
							4: "16th",
							2: "32nd",
							1: "64th"
						} as Record<number, string>
					)[size]
					const steps = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
					const pitch = note
						? `<pitch><step>${steps[note.number % 12]}</step>${[1, 3, 6, 8, 10].includes(note.number % 12) ? "<alter>1</alter>" : ""}<octave>${Math.floor(note.number / 12) - 1}</octave></pitch>`
						: "<rest/>"
					const ties = note
						? `${cursor > start ? '<tie type="stop"/>' : ""}${cursor + size < until ? '<tie type="start"/>' : ""}`
						: ""
					const notations = ties
						? `<notations>${ties.replace(/<tie /g, "<tied ")}</notations>`
						: ""
					measures
						.at(-1)!
						.push(
							`<note>${pitch}<duration>${size}</duration>${ties}<type>${type}</type>${notations}</note>`
						)
					cursor += size
				}
			}
			for (const note of quantized) {
				writeSpan(note.start)
				writeSpan(Math.max(cursor + 1, note.end), note)
			}
			writeSpan(Math.ceil(cursor / 64) * 64)
			return `<part id="P${index}">${measures.map((content, bar) => `<measure number="${bar + 1}">${bar === 0 ? `<attributes><divisions>16</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="${bpm}"/></direction>` : ""}${content.join("")}</measure>`).join("")}</part>`
		})
		.join("")
	const definitions = voices
		.map(
			(notes, index) =>
				`<score-part id="P${index}"><part-name>Voice ${index + 1}</part-name><score-instrument id="I${index}"><instrument-name>Instrument</instrument-name></score-instrument><midi-instrument id="I${index}"><midi-channel>${notes[0].channel}</midi-channel><midi-program>${notes[0].patch + 1}</midi-program></midi-instrument></score-part>`
		)
		.join("")
	return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${escapeXML(recording.name)}</work-title></work><part-list>${definitions}</part-list>${parts}</score-partwise>`
}

export async function createNotationFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	format: "guitar-pro" | "alphatex"
): Promise<Uint8Array<ArrayBuffer> | string> {
	const { importer, exporter, Settings } = await import("@coderline/alphatab/core")
	const xml = notationXML(recording, exportTempo(timer))
	const settings = new Settings()
	const score = importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml), settings)
	return format === "alphatex"
		? new exporter.AlphaTexExporter().exportToString(score, settings)
		: Uint8Array.from(new exporter.Gp7Exporter().export(score, settings))
}

export async function exportInterchangeRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	format: InterchangeExportId
): Promise<Blob> {
	switch (format) {
		case "reaper":
			return new Blob(
				[
					(await import("./adapter-reaper")).createReaperFromAudioEventRecording(
						recording,
						timer
					)
				],
				{ type: "text/plain;charset=utf-8" }
			)
		case "svp":
		case "ustx":
		case "ufdata":
		case "lmms":
		case "lmms-compressed":
			return (await import("./adapter-project-notes")).exportProjectNotes(
				recording,
				timer,
				format
			)
		case "tone-json":
			return new Blob([createToneJSONFromAudioEventRecording(recording, timer)], {
				type: "application/json"
			})
		case "jams":
			return new Blob([createJAMSFromAudioEventRecording(recording)], {
				type: "application/json"
			})
		case "ust":
			return new Blob([createUSTFromAudioEventRecording(recording, timer)], {
				type: "text/plain;charset=utf-8"
			})
		case "svl":
			return new Blob([createSVLFromAudioEventRecording(recording)], {
				type: "application/xml"
			})
		case "rmid":
			return new Blob([createRMIDFromAudioEventRecording(recording, timer)], {
				type: "audio/rmid"
			})
		case "guitar-pro":
			return new Blob(
				[await createNotationFromAudioEventRecording(recording, timer, format)],
				{ type: "application/octet-stream" }
			)
		case "alphatex":
			return new Blob(
				[await createNotationFromAudioEventRecording(recording, timer, format)],
				{ type: "text/plain;charset=utf-8" }
			)
	}
}