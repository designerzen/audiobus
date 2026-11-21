import {
	normalizeSong,
	songFromRecording,
	songTimeAxis,
	type SongSource
} from "../formats/song-source"
import { type NoteRecording } from "../formats/note-sequence"
import { quoteReaper } from "../formats/reaper-project"

/** Self-contained REAPER project with editable MIDI clips, track names and a project tempo. */
export function createReaperFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	if (recording.song) {
		return createReaperFromSong(recording.song)
	}
	// Recorded tracks are named after their source, as before songs existed.
	const song = songFromRecording(recording, timer)
	return createReaperFromSong({
		...song,
		tracks: song.tracks.map((track) => ({ ...track, name: track.source ?? track.name }))
	})
}
/** REAPER project with named tracks and a tempo envelope holding tempo and meter changes */
export function createReaperFromSong(source: SongSource): string {
	const song = normalizeSong(source)
	const bpm = song.tempos[0].bpm,
		ppq = 960,
		axis = songTimeAxis(song)
	const groups = new Map(song.tracks.map((track, i) => [i, track.notes]))
	if (!groups.size) {
		throw new Error("Record some notes before exporting a REAPER project")
	}
	if (groups.size > 1024) {
		throw new Error("REAPER export exceeds 1,024 MIDI tracks")
	}
	const hex = (number: number) => number.toString(16).padStart(2, "0")
	const tracks = [...groups.values()]
		.map((notes, index) => {
			const channel = notes[0].channel - 1
			const events = [{ tick: 0, priority: -1, bytes: [0xc0 | channel, notes[0].patch] }]
			for (const note of notes) {
				const start = Math.round(axis.ticks(note.start, ppq)),
					end = Math.max(
						start + 1,
						Math.round(axis.ticks(note.start + note.duration, ppq))
					)
				events.push(
					{
						tick: start,
						priority: 1,
						bytes: [0x90 | channel, note.number, note.velocity]
					},
					{ tick: end, priority: 0, bytes: [0x80 | channel, note.number, 0] }
				)
			}
			events.sort((a, b) => a.tick - b.tick || a.priority - b.priority)
			const endTick = events.at(-1)!.tick,
				length = axis.tickSeconds(endTick, ppq)
			let previous = 0
			const messages = events.map((event) => {
				const delta = event.tick - previous
				previous = event.tick
				return `E ${delta} ${event.bytes.map(hex).join(" ")}`
			})
			messages.push(`E 0 ${hex(0xb0 | channel)} 7b 00`)
			const name = quoteReaper(song.tracks[index].name)
			return `<TRACK {${crypto.randomUUID().toUpperCase()}}
NAME ${name}
VOLPAN 1 0 1 -1
MUTESOLO 0 0 0
MAINSEND 1
<ITEM
POSITION 0
LENGTH ${length}
LOOP 0
MUTE 0
NAME ${name}
SOFFS 0
PLAYRATE 1 1 0 -1 0 0.0025
<SOURCE MIDI
HASDATA 1 ${ppq} QN
${messages.join("\n")}
IGNTEMPO 0 ${bpm} 4 4
>
>
>`
		})
		.join("\n")
	const times = [...new Set([...song.tempos, ...song.meters].map((e) => e.time))].sort(
		(a, b) => a - b
	)
	// Square tempo points; only points where a meter starts carry a time signature.
	const envelope = times
		.map((time) => {
			const tempo = song.tempos.filter((t) => t.time <= time).at(-1)!
			const meter = song.meters.find((m) => m.time === time)
			return meter
				? `PT ${time} ${tempo.bpm} 1 ${meter.numerator + (meter.denominator << 16)} 0 1`
				: `PT ${time} ${tempo.bpm} 1`
		})
		.join("\n")
	return `<REAPER_PROJECT 0.1 7.0 1\nTEMPO ${bpm} ${song.meters[0].numerator} ${song.meters[0].denominator}\n<TEMPOENVEX\nACT 1 -1\nVIS 1 0 0\n${envelope}\n>\n${tracks}\n>\n`
}