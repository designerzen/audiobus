import { zipSync, strToU8 } from "fflate"
import {
	recordingVoices,
	exportTempo,
	escapeXML,
	type NoteRecording
} from "../formats/note-sequence"

/** Measured MuseScore 4 notation, quantized to a 1/64-note grid. */
export async function createMuseScoreFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	compressed: boolean
): Promise<Blob> {
	const bpm = exportTempo(timer),
		voices = recordingVoices(recording)
	if (!voices.length || voices.length > 128) {
		throw new Error("MuseScore export requires 1–128 voices")
	}
	const scale = (bpm / 60) * 16
	const quantized = voices.map((voice) =>
		voice.map((note) => {
			const start = Math.round(note.start * scale)
			return {
				...note,
				start,
				end: Math.max(start + 1, Math.round((note.start + note.duration) * scale))
			}
		})
	)
	const end = Math.max(...quantized.map((voice) => voice.at(-1)!.end))
	if (end > 100000) {
		throw new Error("Score is too long for MuseScore export")
	}
	const bars = Math.ceil(end / 64)
	const groups = new Map<string, number[]>()
	for (const [index, voice] of voices.entries()) {
		const key = `${voice[0].channel}:${voice[0].patch}`
		const group = groups.get(key) ?? []
		group.push(index)
		groups.set(key, group)
	}
	if ([...groups.values()].filter(([index]) => voices[index][0].channel !== 10).length > 15) {
		throw new Error("MuseScore export supports 15 melodic instruments plus drums")
	}
	const definitions = [...groups.values()]
		.map((indices) => {
			const note = voices[indices[0]][0]
			return `<Part>${indices.map((index) => `<Staff id="${index + 1}"><StaffType group="${note.channel === 10 ? "percussion" : "pitched"}"/></Staff>`).join("")}<trackName>Channel ${note.channel}</trackName><Instrument><longName>Channel ${note.channel}</longName>${note.channel === 10 ? "<useDrumset>1</useDrumset>" : ""}<Channel><program value="${note.patch}"/><controller ctrl="7" value="100"/></Channel></Instrument></Part>`
		})
		.join("")
	const types: Record<number, string> = {
		64: "whole",
		32: "half",
		16: "quarter",
		8: "eighth",
		4: "16th",
		2: "32nd",
		1: "64th"
	}
	const tpcs = [14, 21, 16, 23, 18, 13, 20, 15, 22, 17, 24, 19]
	const staves = quantized
		.map((voice, index) => {
			const measures: string[][] = Array.from({ length: bars }, () => [])
			let cursor = 0
			const location = (from: number, to: number) =>
				`<location><measures>${Math.floor(to / 64) - Math.floor(from / 64)}</measures><fractions>${(to % 64) - (from % 64)}/64</fractions></location>`
			const writeSpan = (until: number, note?: (typeof voice)[number]) => {
				let previous: number | undefined
				while (cursor < until) {
					const available = Math.min(until - cursor, 64 - (cursor % 64))
					const size = 2 ** Math.floor(Math.log2(available))
					const duration = `<durationType>${types[size]}</durationType>`
					const ties = note
						? `${previous !== undefined ? `<Spanner type="Tie"><prev>${location(cursor, previous)}</prev></Spanner>` : ""}${cursor + size < until ? `<Spanner type="Tie"><Tie/><next>${location(cursor, cursor + size)}</next></Spanner>` : ""}`
						: ""
					measures[Math.floor(cursor / 64)].push(
						note
							? `<Dynamic><subtype>other-dynamics</subtype><velocity>${note.velocity}</velocity></Dynamic><Chord>${duration}<Note><pitch>${note.number}</pitch><tpc>${tpcs[note.number % 12]}</tpc>${ties}</Note></Chord>`
							: `<Rest>${duration}</Rest>`
					)
					previous = cursor
					cursor += size
				}
			}
			for (const note of voice) {
				writeSpan(note.start)
				writeSpan(Math.max(cursor + 1, note.end), note)
			}
			writeSpan(bars * 64)
			return `<Staff id="${index + 1}">${measures.map((content, bar) => `<Measure><voice>${bar === 0 ? `<TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig><Tempo><tempo>${bpm / 60}</tempo><text>${bpm}</text></Tempo>` : ""}${content.join("")}</voice></Measure>`).join("")}</Staff>`
		})
		.join("")
	const xml = `<?xml version="1.0" encoding="UTF-8"?><museScore version="4.00"><programVersion>4.0.0</programVersion><Score><Division>480</Division><metaTag name="workTitle">${escapeXML(recording.name)}</metaTag>${definitions}${staves}</Score></museScore>`
	if (!compressed) {
		return new Blob([xml], { type: "application/x-musescore+xml" })
	}
	const archive = zipSync({
		"META-INF/container.xml": strToU8(
			'<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.mscx"/></rootfiles></container>'
		),
		"score.mscx": strToU8(xml)
	})
	return new Blob([Uint8Array.from(archive).buffer], { type: "application/x-musescore" })
}