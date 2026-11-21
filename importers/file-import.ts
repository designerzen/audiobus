import { MAX_MEDIA_BYTES, readMediaArchive } from "./dropped-media"
import { TRACKER_EXTENSIONS, importTrackerFile } from "./import-tracker-file"
import { importMIDIFile } from "./import-midi-file"
import { parseMusicJSON } from "../formats/project-time"
import type { IAudioCommand } from "../commands/audio-command-interface"

export const FILE_IMPORT_FORMATS = [
	{
		id: "midi",
		label: "MIDI",
		kind: "notes",
		extensions: ["mid", "midi", "kar"]
	},
	{ id: "rmid", label: "RIFF MIDI", kind: "notes", extensions: ["rmi", "rmid"] },
	{ id: "tone-json", label: "Tone.js MIDI JSON", kind: "notes", extensions: ["tone.json"] },
	{ id: "jams", label: "JAMS note annotations", kind: "notes", extensions: ["jams"] },
	{ id: "ust", label: "UTAU melody", kind: "notes", extensions: ["ust"] },
	{ id: "svl", label: "Sonic Visualiser note layer", kind: "notes", extensions: ["svl"] },
	{ id: "svp", label: "Synthesizer V notes", kind: "notes", extensions: ["svp"] },
	{ id: "ustx", label: "OpenUtau notes", kind: "notes", extensions: ["ustx"] },
	{ id: "ufdata", label: "UtaFormatix data", kind: "notes", extensions: ["ufdata"] },
	{
		id: "lmms",
		label: "LMMS song instrument patterns",
		kind: "notes",
		extensions: ["mmp", "mpt"]
	},
	{
		id: "lmms-compressed",
		label: "Compressed LMMS song instrument patterns",
		kind: "notes",
		extensions: ["mmpz"]
	},
	{ id: "musicxml", label: "MusicXML", kind: "notes", extensions: ["musicxml", "xml"] },
	{ id: "mxl", label: "Compressed MusicXML", kind: "notes", extensions: ["mxl"] },
	{
		id: "musescore",
		label: "MuseScore 3/4 written notes",
		kind: "notes",
		extensions: ["mscx", "mscz"]
	},
	{ id: "reaper", label: "REAPER embedded MIDI", kind: "notes", extensions: ["rpp"] },
	{ id: "dawproject", label: "DAWproject", kind: "notes", extensions: ["dawproject"] },
	{ id: "tracker", label: "Tracker module", kind: "notes", extensions: TRACKER_EXTENSIONS },
	{ id: "abc", label: "ABC notation", kind: "notes", extensions: ["abc"] },
	{ id: "midi-csv", label: "MIDI CSV", kind: "notes", extensions: ["csv"] },
	{ id: "mml", label: "Core MML", kind: "notes", extensions: ["mml"] },
	{ id: "rtttl", label: "RTTTL ringtone", kind: "notes", extensions: ["rtttl", "rtx"] },
	{
		id: "guitar-pro",
		label: "Guitar Pro 3–8",
		kind: "notes",
		extensions: ["gp3", "gp4", "gp5", "gpx", "gp"]
	},
	{ id: "capella", label: "Capella", kind: "notes", extensions: ["capx"] },
	{ id: "alphatex", label: "alphaTex", kind: "notes", extensions: ["atex", "alphatex"] },
	{
		id: "notesequence",
		label: "Magenta NoteSequence JSON",
		kind: "notes",
		extensions: ["json", "noteseq"]
	},
	{
		id: "audio",
		label: "Audio",
		kind: "audio",
		extensions: [
			"wav",
			"mp3",
			"ogg",
			"oga",
			"opus",
			"flac",
			"m4a",
			"aac",
			"aif",
			"aiff",
			"webm"
		]
	},
	{
		id: "bundle",
		label: "MIDI / WAM2 bundle",
		kind: "bundle",
		extensions: ["zip", "wam", "wam2"]
	},
	{
		id: "soundfont",
		label: "SoundFont or MIDI.js soundfont",
		kind: "soundfont",
		extensions: ["sf2", "sf3"]
	}
] as const
export type ImportFormat = (typeof FILE_IMPORT_FORMATS)[number]
export type ImportFormatId = ImportFormat["id"]
export interface DetectedImportFile {
	format: ImportFormat
	archive?: Record<string, Uint8Array>
}
export const IMPORT_FILE_ACCEPT = FILE_IMPORT_FORMATS.flatMap((format) =>
	format.extensions.map((extension) => `.${extension}`)
).join(",")
const byId = (id: ImportFormatId): ImportFormat =>
	FILE_IMPORT_FORMATS.find((format) => format.id === id)!
const decoder = new TextDecoder()
const MAX_SOUNDFONT_BYTES = 1024 * 1024 * 1024
// MIDI.js packs are scripts or JSON mapping note names to base64 audio
const MIDI_JS_PACK = /MIDI\.Soundfont\b|^\{\s*"[A-G][#b]?-?\d"\s*:\s*"data:audio\//

/** Detect content before falling back to suffixes; ZIP containers are inspected, never executed. */
export async function detectImportFile(file: File): Promise<DetectedImportFile> {
	if (!file.size) {
		throw new Error("Choose a nonempty file up to 64 MB")
	}
	const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer())
	const at = (offset: number, size: number) =>
		decoder.decode(bytes.subarray(offset, offset + size))
	// Soundfonts are read in place by the Rompler, so they may be larger than other media
	if (at(0, 4) === "RIFF" && at(8, 4) === "sfbk") {
		if (file.size > MAX_SOUNDFONT_BYTES) {
			throw new Error("Choose a soundfont up to 1 GB")
		}
		return { format: byId("soundfont") }
	}
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("Choose a nonempty file up to 64 MB")
	}
	const extension = file.name.toLowerCase().split(".").pop() ?? ""
	const suffix = FILE_IMPORT_FORMATS.find((format) =>
		format.extensions.some((suffix) => file.name.toLowerCase().endsWith(`.${suffix}`))
	)
	const found = (id: ImportFormatId): DetectedImportFile => ({ format: byId(id) })
	if (at(0, 4) === "MThd") {
		return found("midi")
	}
	if (at(0, 4) === "RIFF" && at(8, 4) === "RMID") {
		return found("rmid")
	}
	if (
		at(0, 17) === "Extended Module: " ||
		at(0, 4) === "IMPM" ||
		/^MMD[0-3]$/.test(at(0, 4)) ||
		at(44, 4) === "SCRM" ||
		/^(M\.K\.|M!K!|FLT[48]|[1-9]CHN|[0-9]{2}CH)$/.test(at(1080, 4)) ||
		["DBM0", "DMDL", "PTMF", "PSM ", "MT20", "IM10", "XPKF"].includes(at(0, 4)) ||
		(["PSM", "FAR", "GDM"].includes(at(0, 3)) && bytes[3] === 0xfe) ||
		["MTM", "MO3", "AMF"].includes(at(0, 3)) ||
		["OKTASONG", "ziRCONia"].includes(at(0, 8)) ||
		(at(0, 4) === "RIFF" && at(8, 4) === "DSMF")
	) {
		return found("tracker")
	}
	if (at(0, 4) === "BCFZ" || at(0, 4) === "BCFS" || at(0, 40).includes("FICHIER GUITAR PRO")) {
		return found("guitar-pro")
	}
	if (
		(at(0, 4) === "RIFF" && at(8, 4) === "WAVE") ||
		(at(0, 4) === "FORM" && /^(AIFF|AIFC)$/.test(at(8, 4))) ||
		["OggS", "fLaC"].includes(at(0, 4)) ||
		at(0, 3) === "ID3" ||
		at(4, 4) === "ftyp" ||
		(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
	) {
		return found("audio")
	}
	if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
		const archive = await readMediaArchive(new Uint8Array(await file.arrayBuffer()))
		const paths = Object.keys(archive)
		let id: ImportFormatId = "bundle"
		if (
			paths.some(
				(path) =>
					/\.mscx$/i.test(path) &&
					/<museScore[\s>]/.test(decoder.decode(archive[path].subarray(0, 4096)))
			)
		) {
			id = "musescore"
		} else if (archive["META-INF/container.xml"]) {
			id = "mxl"
		} else if (archive["project.xml"] || archive["project.json"]) {
			id = "dawproject"
		} else if (paths.some((path) => /(^|\/)score\.gpif$/i.test(path))) {
			id = "guitar-pro"
		} else if (
			archive["score.xml"] &&
			/<score[\s>]/.test(decoder.decode(archive["score.xml"].subarray(0, 4096)))
		) {
			id = "capella"
		} else if (suffix?.id === "capella" || suffix?.id === "guitar-pro") {
			id = suffix.id
		}
		return { format: byId(id), archive }
	}
	const text = decoder
		.decode(bytes)
		.replace(/^\uFEFF/, "")
		.trimStart()
	if (/^<REAPER_PROJECT\b/.test(text)) {
		return found("reaper")
	}
	if (/<museScore[\s>]/.test(text)) {
		return found("musescore")
	}
	if (bytes.length >= 6 && bytes[4] === 0x78 && ((bytes[4] << 8) + bytes[5]) % 31 === 0) {
		const { decodeLMMSContainer } = await import("../formats/lmms-container")
		const xml = decodeLMMSContainer(new Uint8Array(await file.arrayBuffer()))
		if (/<(?:lmms|multimedia)-project[\s/>]/.test(xml)) {
			return found("lmms-compressed")
		}
	}
	if (MIDI_JS_PACK.test(text)) {
		return found("soundfont")
	}
	if (text.startsWith("{")) {
		let data
		try {
			data = parseMusicJSON(await file.text())
		} catch {
			throw new Error("Invalid JSON file")
		}
		if (data?.time && Array.isArray(data.tracks)) {
			return found("svp")
		}
		if (data?.formatVersion !== undefined && Array.isArray(data.project?.tracks)) {
			return found("ufdata")
		}
		if (data?.ustx_version && Array.isArray(data.voice_parts)) {
			return found("ustx")
		}
		if (data?.header && Array.isArray(data.tracks)) {
			return found("tone-json")
		}
		if (Array.isArray(data?.annotations)) {
			return found("jams")
		}
		if (
			data &&
			Array.isArray(data.notes) &&
			(data.notes.length === 0 ||
				data.notes.some(
					(note: any) =>
						note &&
						typeof note === "object" &&
						"pitch" in note &&
						("startTime" in note ||
							"start_time" in note ||
							"quantizedStartStep" in note ||
							"quantized_start_step" in note ||
							"quantizedEndStep" in note ||
							"quantized_end_step" in note ||
							"endTime" in note ||
							"end_time" in note)
				))
		) {
			return found("notesequence")
		}
		throw new Error(
			"This JSON is not a Magenta NoteSequence or supported music project. For WAM instruments, choose a complete ZIP bundle or a hosted plugin URL."
		)
	}
	if (/<(?:[\w-]+:)?score-(?:partwise|timewise)[\s/>]/.test(text)) {
		return found("musicxml")
	}
	if (/<Project[\s/>]/.test(text)) {
		return found("dawproject")
	}
	if (/<(?:lmms|multimedia)-project[\s/>]/.test(text)) {
		return found("lmms")
	}
	if (/^ustx_version\s*:/m.test(text)) {
		return found("ustx")
	}
	if (/<sv[\s/>]/.test(text)) {
		return found("svl")
	}
	if (/^\[#SETTING\]\s*$/im.test(text)) {
		return found("ust")
	}
	if (/^K:/m.test(text)) {
		return found("abc")
	}
	if (/^\s*0\s*,\s*0\s*,\s*Header\s*,/im.test(text)) {
		return found("midi-csv")
	}
	if (/^[^:\r\n]{1,64}:[dobDOB=0-9,\s]*:[\s\S]+$/.test(text.trim())) {
		return found("rtttl")
	}
	if (/^\\(?:title|track|tempo|tuning|instrument)\b/.test(text)) {
		return found("alphatex")
	}
	if (/^(?:t\d+|o-?\d+|l\d+)\s*(?:[a-grntolvq@<>[;]|\d)/i.test(text)) {
		return found("mml")
	}
	if (suffix?.id === "midi" || /^(audio|application)\/(x-)?midi$/i.test(file.type)) {
		throw new Error("This file does not contain a Standard MIDI File header")
	}
	if (suffix?.id === "notesequence") {
		throw new Error("Expected Magenta NoteSequence JSON")
	}
	if (suffix) {
		return { format: suffix }
	}
	// Traditional Amiga filenames often put the format before the title (mod.song).
	if (TRACKER_EXTENSIONS.some((prefix) => file.name.toLowerCase().startsWith(`${prefix}.`))) {
		return found("tracker")
	}
	if (file.type.startsWith("audio/")) {
		return found("audio")
	}
	throw new Error(
		`Unsupported file type: ${extension || file.type || "unknown"}. Choose a supported music file, audio file or WAM2 ZIP bundle.`
	)
}

export async function importMusicalFile(
	file: File,
	id?: ImportFormatId
): Promise<{ commands: IAudioCommand[]; noteCount: number }> {
	id ??= (await detectImportFile(file)).format.id
	switch (id) {
		case "midi":
			return importMIDIFile(file)
		case "musescore":
			return (await import("./import-musescore")).importMuseScoreFile(file)
		case "reaper":
			return (await import("./import-reaper")).importReaperFile(file)
		case "svp":
			return (await import("./import-vocal-project")).importSVPFile(file)
		case "ustx":
			return (await import("./import-vocal-project")).importUSTXFile(file)
		case "ufdata":
			return (await import("./import-vocal-project")).importUFDataFile(file)
		case "lmms":
		case "lmms-compressed":
			return (await import("./import-lmms")).importLMMSFile(file)
		case "rmid":
			return (await import("./import-rmid")).importRMIDFile(file)
		case "tone-json":
			return (await import("./import-json-notes")).importToneJSONFile(file)
		case "jams":
			return (await import("./import-json-notes")).importJAMSFile(file)
		case "ust":
			return (await import("./import-ust")).importUSTFile(file)
		case "svl":
			return (await import("./import-svl")).importSVLFile(file)
		case "abc":
			return (await import("./import-abc")).importABCFile(file)
		case "midi-csv":
			return (await import("./import-midi-csv")).importMIDICSVFile(file)
		case "mml":
			return (await import("./import-mml")).importMMLFile(file)
		case "rtttl":
			return (await import("./import-rtttl")).importRTTTLFile(file)
		case "musicxml":
		case "mxl":
			return (await import("./import-musicxml-import")).importMusicXMLFile(file)
		case "tracker":
			return importTrackerFile(file)
		case "notesequence":
			return (await import("./import-note-sequence")).importNoteSequenceFile(file)
		case "alphatex":
			return (await import("./import-notation-file")).importNotationFile(file, true)
		case "guitar-pro":
		case "capella":
			return (await import("./import-notation-file")).importNotationFile(file)
		case "dawproject": {
			const bytes = new Uint8Array(await file.slice(0, 2).arrayBuffer())
			return bytes[0] === 0x50 && bytes[1] === 0x4b
				? (await import("./import-dawproject")).importDawProjectFile(file)
				: (await import("./import-dawproject-xml")).importDawProjectXML(
						await file.text(),
						file.name
					)
		}
		default:
			throw new Error(
				"This file contains audio or an instrument bundle, rather than note data"
			)
	}
}