import { zipSync, strToU8 } from "fflate"
import {
	recordingNotes,
	exportTempo,
	escapeXML,
	type NoteRecording,
	type SequenceNote
} from "../formats/note-sequence"

/** MusicXML performance score: one unmetered measure per part, preserving overlaps. */
export async function createMusicXMLFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> {
	const bpm = exportTempo(timer),
		divisions = 480
	const groups = new Map<string, SequenceNote[]>()
	for (const note of recordingNotes(recording)) {
		const key = `${note.channel}:${note.patch}`
		const notes = groups.get(key) ?? []
		notes.push(note)
		groups.set(key, notes)
	}
	if (!groups.size) {
		groups.set("1:0", [])
	}
	const parts = [...groups.values()]
	const title = escapeXML(recording.name)
	const partList = parts
		.map((notes, index) => {
			const id = `P${index + 1}`,
				note = notes[0]
			return `<score-part id="${id}"><part-name>${title} ${index + 1}</part-name><score-instrument id="${id}-I"><instrument-name>Instrument</instrument-name></score-instrument><midi-instrument id="${id}-I"><midi-channel>${note?.channel ?? 1}</midi-channel><midi-program>${(note?.patch ?? 0) + 1}</midi-program></midi-instrument></score-part>`
		})
		.join("")
	const partContent = parts
		.map((notes, index) => {
			let cursor = 0
			const content = notes
				.map((note) => {
					const start = Math.round(((note.start * bpm) / 60) * divisions)
					const duration = Math.max(
						1,
						Math.round(((note.duration * bpm) / 60) * divisions)
					)
					const move =
						start === cursor
							? ""
							: `<${start < cursor ? "backup" : "forward"}><duration>${Math.abs(start - cursor)}</duration></${start < cursor ? "backup" : "forward"}>`
					cursor = start + duration
					const steps = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
					const sharp = [1, 3, 6, 8, 10].includes(note.number % 12)
					return `${move}<note dynamics="${(note.velocity * 100) / 90}"><pitch><step>${steps[note.number % 12]}</step>${sharp ? "<alter>1</alter>" : ""}<octave>${Math.floor(note.number / 12) - 1}</octave></pitch><duration>${duration}</duration></note>`
				})
				.join("")
			return `<part id="P${index + 1}"><measure number="1" implicit="yes"><attributes><divisions>${divisions}</divisions><time><senza-misura/></time></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>${content || `<note><rest/><duration>${divisions * 4}</duration></note>`}</measure></part>`
		})
		.join("")
	return new Blob(
		[
			`<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><part-list>${partList}</part-list>${partContent}</score-partwise>`
		],
		{ type: "application/vnd.recordare.musicxml+xml" }
	)
}

export async function createMXLFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> {
	const xml = await createMusicXMLFromAudioEventRecording(recording, timer)
	const archive = zipSync({
		mimetype: [strToU8("application/vnd.recordare.musicxml"), { level: 0 }],
		"META-INF/container.xml": strToU8(
			'<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>'
		),
		"score.musicxml": strToU8(await xml.text())
	})
	return new Blob([Uint8Array.from(archive).buffer], {
		type: "application/vnd.recordare.musicxml"
	})
}

export function saveBlobToLocalFileSystem(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob),
		link = document.createElement("a")
	link.href = url
	link.download = `${fileName}.musicxml`
	document.body.append(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
}