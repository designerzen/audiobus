import {
	recordingNotes,
	exportTempo,
	type NoteRecording,
	type SequenceNote
} from "../formats/note-sequence"
import { quoteReaper } from "../formats/reaper-project"

/** Self-contained REAPER project with editable MIDI clips, track names and a project tempo. */
export function createReaperFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = exportTempo(timer),
		ppq = 960
	const groups = new Map<string, SequenceNote[]>()
	for (const note of recordingNotes(recording, { sources: true })) {
		const key = JSON.stringify([note.source, note.channel, note.patch]),
			group = groups.get(key) ?? []
		group.push(note)
		groups.set(key, group)
	}
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
				const start = Math.round(((note.start * bpm) / 60) * ppq),
					end = Math.max(
						start + 1,
						Math.round((((note.start + note.duration) * bpm) / 60) * ppq)
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
				length = ((endTick / ppq) * 60) / bpm
			let previous = 0
			const messages = events.map((event) => {
				const delta = event.tick - previous
				previous = event.tick
				return `E ${delta} ${event.bytes.map(hex).join(" ")}`
			})
			messages.push(`E 0 ${hex(0xb0 | channel)} 7b 00`)
			const name = quoteReaper(notes[0].source ?? `${recording.name} ${index + 1}`)
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
	return `<REAPER_PROJECT 0.1 7.0 1\nTEMPO ${bpm} 4 4\n${tracks}\n>\n`
}