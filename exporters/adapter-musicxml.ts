import { zipSync, strToU8 } from "fflate"
import { escapeXML, type NoteRecording } from "../formats/note-sequence"
import {
	normalizeSong,
	songFromRecording,
	songTimeAxis,
	songBars,
	type SongSource
} from "../formats/song-source"

/** Metered performance score from the recording at the timer's tempo */
export async function createMusicXMLFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): Promise<Blob> {
	return createMusicXMLFromSong(recording.song ?? songFromRecording(recording, timer))
}

const STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]

/** Metered performance score: bar lines follow the meters, notes crossing them are tied,
 * and overlaps within a part use backup.
 */
export async function createMusicXMLFromSong(source: SongSource): Promise<Blob> {
	const song = normalizeSong(source),
		axis = songTimeAxis(song),
		divisions = 480,
		tick = (seconds: number) => Math.round(axis.ticks(seconds, divisions))
	const tracks = song.tracks.length
		? song.tracks
		: [{ name: song.name, channel: 1, patch: 0, notes: [] }]
	const end = Math.max(
		0,
		...tracks.flatMap((track) =>
			track.notes.map((note) =>
				Math.max(tick(note.start) + 1, tick(note.start + note.duration))
			)
		)
	)
	const bars = songBars(song, axis.tickSeconds(end, divisions)).map((bar) => ({
		...bar,
		start: Math.round(bar.start * divisions),
		end: Math.round(bar.end * divisions)
	}))
	const partList = tracks
		.map(
			(track, index) =>
				`<score-part id="P${index + 1}"><part-name>${escapeXML(track.name)}</part-name><score-instrument id="P${index + 1}-I1"><instrument-name>${escapeXML(track.name)}</instrument-name></score-instrument><midi-instrument id="P${index + 1}-I1"><midi-channel>${track.channel}</midi-channel><midi-program>${track.patch + 1}</midi-program></midi-instrument></score-part>`
		)
		.join("")
	const parts = tracks
		.map((track, part) => {
			const notes = track.notes.map((note) => {
				const start = tick(note.start)
				return {
					...note,
					start,
					end: Math.max(start + 1, tick(note.start + note.duration))
				}
			})
			const measures = bars
				.map((bar, index) => {
					const previous = bars[index - 1]
					const meter =
						!previous ||
						previous.numerator !== bar.numerator ||
						previous.denominator !== bar.denominator
					const attributes =
						index === 0 || meter
							? `<attributes>${index === 0 ? `<divisions>${divisions}</divisions>` : ""}${index === 0 && song.key ? `<key><fifths>${song.key.fifths}</fifths><mode>${song.key.mode}</mode></key>` : ""}${meter ? `<time><beats>${bar.numerator}</beats><beat-type>${bar.denominator}</beat-type></time>` : ""}</attributes>`
							: ""
					// Tempo marks belong to the first part; importers read them as global.
					const tempos = part
						? ""
						: song.tempos
								.map((tempo) => ({ bpm: tempo.bpm, at: tick(tempo.time) }))
								.filter(({ at }) => at >= bar.start && at < bar.end)
								.map(
									({ bpm, at }) =>
										`<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type>${at > bar.start ? `<offset>${at - bar.start}</offset>` : ""}<sound tempo="${bpm}"/></direction>`
								)
								.join("")
					let cursor = bar.start
					const content = notes
						.filter((note) => note.start < bar.end && note.end > bar.start)
						.map((note) => {
							const start = Math.max(bar.start, note.start),
								finish = Math.min(bar.end, note.end)
							const direction = start < cursor ? "backup" : "forward"
							const move =
								start === cursor
									? ""
									: `<${direction}><duration>${Math.abs(start - cursor)}</duration></${direction}>`
							cursor = finish
							const ties = `${note.start < bar.start ? '<tie type="stop"/>' : ""}${note.end > bar.end ? '<tie type="start"/>' : ""}`
							return `${move}<note dynamics="${(note.velocity * 100) / 90}"><pitch><step>${STEPS[note.number % 12]}</step>${[1, 3, 6, 8, 10].includes(note.number % 12) ? "<alter>1</alter>" : ""}<octave>${Math.floor(note.number / 12) - 1}</octave></pitch><duration>${finish - start}</duration>${ties}${ties ? `<notations>${ties.replace(/<tie /g, "<tied ")}</notations>` : ""}</note>`
						})
						.join("")
					const fill =
						cursor < bar.end
							? `<forward><duration>${bar.end - cursor}</duration></forward>`
							: ""
					return `<measure number="${index + 1}">${attributes}${tempos}${content}${fill}</measure>`
				})
				.join("")
			return `<part id="P${part + 1}">${measures}</part>`
		})
		.join("")
	return new Blob(
		[
			`<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXML(song.name)}</work-title></work><part-list>${partList}</part-list>${parts}</score-partwise>`
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

/** Compressed MusicXML from a song */
export function createMXLFromSong(song: SongSource): Promise<Blob> {
	return createMXLFromAudioEventRecording(
		{ name: song.name, events: [], duration: 0, song },
		{ BPM: song.tempos[0].bpm }
	)
}