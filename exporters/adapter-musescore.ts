import {
	normalizeSong,
	songFromRecording,
	songVoices,
	songTimeAxis,
	songBars,
	type SongSource
} from "../formats/song-source"
import { zipSync, strToU8 } from "fflate"
import { escapeXML, type NoteRecording } from "../formats/note-sequence"

/** Measured MuseScore 4 notation, quantized to a 1/64-note grid. */
export async function createMuseScoreFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	compressed: boolean
): Promise<Blob> {
	return createMuseScoreFromSong(
		recording.song ?? songFromRecording(recording, timer),
		compressed
	)
}
export async function createMuseScoreFromSong(
	source: SongSource,
	compressed = false
): Promise<Blob> {
	const song = normalizeSong(source)
	const axis = songTimeAxis(song)
	// Each track becomes a part with one staff per monophonic voice.
	const entries = song.tracks.flatMap((track, trackIndex) =>
		songVoices({ ...song, tracks: [track] }).map((notes) => ({ track, trackIndex, notes }))
	)
	const voices = entries.map((entry) => entry.notes)
	if (!voices.length || voices.length > 128) {
		throw new Error("MuseScore export requires 1–128 voices")
	}
	const quantized = voices.map((voice) =>
		voice.map((note) => {
			const start = Math.round(axis.beats(note.start) * 16)
			return {
				...note,
				start,
				end: Math.max(start + 1, Math.round(axis.beats(note.start + note.duration) * 16))
			}
		})
	)
	const end = Math.max(...quantized.map((voice) => voice.at(-1)!.end))
	if (end > 100000) {
		throw new Error("Score is too long for MuseScore export")
	}
	// Bars follow the meters, extended to cover the last quantized note.
	const boundaries = songBars(song, axis.seconds(end / 16)).map((bar) => ({
		...bar,
		start: Math.round(bar.start * 16),
		end: Math.round(bar.end * 16)
	}))
	const bars = boundaries.length
	const barAt = (tick: number) =>
		tick >= boundaries.at(-1)!.end
			? bars
			: Math.max(
					0,
					boundaries.findIndex((bar) => tick >= bar.start && tick < bar.end)
				)
	const barStart = (bar: number) => boundaries[bar]?.start ?? boundaries.at(-1)!.end
	const tempoTick = (tempo: SongSource["tempos"][number]) =>
		Math.round(axis.beats(tempo.time) * 16)
	const groups = new Map<string, number[]>()
	for (const index of voices.keys()) {
		const key = String(entries[index].trackIndex)
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
			return `<Part>${indices.map((index) => `<Staff id="${index + 1}"><StaffType group="${note.channel === 10 ? "percussion" : "pitched"}"/></Staff>`).join("")}<trackName>${escapeXML(entries[indices[0]].track.name)}</trackName><Instrument><longName>${escapeXML(entries[indices[0]].track.name)}</longName>${note.channel === 10 ? "<useDrumset>1</useDrumset>" : ""}<Channel><program value="${note.patch}"/><controller ctrl="7" value="100"/></Channel></Instrument></Part>`
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
				`<location><measures>${barAt(to) - barAt(from)}</measures><fractions>${to - barStart(barAt(to)) - (from - barStart(barAt(from)))}/64</fractions></location>`
			const writeSpan = (until: number, note?: (typeof voice)[number]) => {
				let previous: number | undefined
				while (cursor < until) {
					// Split spans at bar lines and tempo changes so each change starts an element.
					const tempo = song.tempos.find((t) => tempoTick(t) > cursor)
					const available = Math.min(
						until - cursor,
						boundaries[barAt(cursor)].end - cursor,
						tempo ? tempoTick(tempo) - cursor : Infinity
					)
					const size = Math.min(64, 2 ** Math.floor(Math.log2(available)))
					const duration = `<durationType>${types[size]}</durationType>`
					const ties = note
						? `${previous !== undefined ? `<Spanner type="Tie"><prev>${location(cursor, previous)}</prev></Spanner>` : ""}${cursor + size < until ? `<Spanner type="Tie"><Tie/><next>${location(cursor, cursor + size)}</next></Spanner>` : ""}`
						: ""
					for (const tempo of song.tempos.filter((t) => tempoTick(t) === cursor)) {
						measures[barAt(cursor)].push(
							`<Tempo><tempo>${tempo.bpm / 60}</tempo><text>${tempo.bpm}</text></Tempo>`
						)
					}
					measures[barAt(cursor)].push(
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
			writeSpan(boundaries.at(-1)!.end)
			const meterChanges = (bar: number) =>
				bar === 0 ||
				boundaries[bar].numerator !== boundaries[bar - 1].numerator ||
				boundaries[bar].denominator !== boundaries[bar - 1].denominator
			return `<Staff id="${index + 1}">${measures.map((content, bar) => `<Measure><voice>${bar === 0 && song.key ? `<KeySig><accidental>${song.key.fifths}</accidental><mode>${song.key.mode}</mode></KeySig>` : ""}${meterChanges(bar) ? `<TimeSig><sigN>${boundaries[bar].numerator}</sigN><sigD>${boundaries[bar].denominator}</sigD></TimeSig>` : ""}${content.join("")}</voice></Measure>`).join("")}</Staff>`
		})
		.join("")
	const xml = `<?xml version="1.0" encoding="UTF-8"?><museScore version="4.00"><programVersion>4.0.0</programVersion><Score><Division>480</Division><metaTag name="workTitle">${escapeXML(song.name)}</metaTag>${definitions}${staves}</Score></museScore>`
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