import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import { decodeLMMSContainer } from "../formats/lmms-container"
import { projectTimeAxis, projectTick } from "../formats/project-time"
import type { SequenceNote } from "../formats/note-sequence"

/** Import song-level instrument patterns, not audio, effects or Beat/Bassline arrangements. */
export async function importLMMSFile(file: File) {
	checkMusicFile(file)
	const bytes = new Uint8Array(await file.arrayBuffer())
	let text = new TextDecoder().decode(bytes)
	if (!/^\s*(?:<\?xml|<!DOCTYPE|<(?:lmms|multimedia)-project)/.test(text)) {
		text = decodeLMMSContainer(bytes)
	}
	text = text.replace(/<!DOCTYPE\s+(?:lmms|multimedia)-project\s*>/i, "")
	if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
		throw new Error("LMMS external document types and entities are unsupported")
	}
	const doc = new DOMParser().parseFromString(text, "application/xml")
	if (
		doc.querySelector("parsererror") ||
		!["lmms-project", "multimedia-project"].includes(doc.documentElement.localName)
	) {
		throw new Error("Expected an LMMS song project")
	}
	const head = doc.querySelector("head"),
		bpmNode = head?.querySelector("bpm")
	const bpm = Number(head?.getAttribute("bpm") ?? bpmNode?.getAttribute("value") ?? 140)
	const time = projectTimeAxis(48, [{ position: 0, bpm }])
	const bpmId = bpmNode?.getAttribute("id")
	if (
		bpmId &&
		[...doc.querySelectorAll("automationpattern object")].some(
			(object) => object.getAttribute("id") === bpmId
		)
	) {
		throw new Error("LMMS tempo automation is unsupported; export the song as MIDI first")
	}
	const master = Number(head?.getAttribute("masterpitch") ?? 0)
	if (!Number.isInteger(master)) {
		throw new Error("Invalid LMMS master pitch")
	}
	const container = doc.querySelector("song > trackcontainer")
	const tracks = [...(container?.children ?? [])].filter(
		(child) => child.localName === "track" && child.getAttribute("type") === "0"
	)
	const notes: SequenceNote[] = []
	for (const [index, track] of tracks.entries()) {
		if (track.getAttribute("muted") === "1") {
			continue
		}
		const instrument = [...track.children].find(
			(child) => child.localName === "instrumenttrack"
		)
		const base = Number(instrument?.getAttribute("basenote") ?? 57)
		const transpose =
			69 - base + (instrument?.getAttribute("usemasterpitch") === "0" ? 0 : master)
		const port = instrument?.querySelector("midiport")
		const channel = Number(
			port?.getAttribute("outputchannel") ?? (index < 9 ? index + 1 : index + 2)
		)
		const patch = Number(port?.getAttribute("outputprogram") ?? 1) - 1
		for (const pattern of [...track.children].filter(
			(child) => child.localName === "pattern"
		)) {
			if (pattern.getAttribute("muted") === "1") {
				continue
			}
			const offset = projectTick(Number(pattern.getAttribute("pos") ?? 0))
			for (const note of pattern.querySelectorAll("note")) {
				if (notes.length >= 100000) {
					throw new Error("LMMS project contains too many notes")
				}
				const length = Number(note.getAttribute("len"))
				if (length <= 0) {
					throw new Error(
						"LMMS step-sequencer notes are unsupported; convert the pattern to piano-roll notes first"
					)
				}
				const start = time(offset + projectTick(Number(note.getAttribute("pos") ?? NaN)))
				const end = time(offset + Number(note.getAttribute("pos")) + projectTick(length))
				const volume = Number(note.getAttribute("vol") ?? 100)
				if (!Number.isFinite(volume) || volume < 0 || volume > 200) {
					throw new Error("Invalid LMMS note volume")
				}
				notes.push({
					number: Number(note.getAttribute("key") ?? NaN) + transpose,
					start,
					duration: end - start,
					velocity: Math.round((volume * 127) / 200),
					channel,
					patch
				})
			}
		}
	}
	return commandsFromNotes(notes, file.name)
}