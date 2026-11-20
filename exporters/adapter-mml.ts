import { recordingVoices, exportTempo, type NoteRecording } from "../formats/note-sequence"

// 96 ticks per quarter; ties express durations unavailable as one denominator.
function lengths(ticks: number): number[] {
	const result: number[] = []
	for (const denominator of [1, 2, 4, 8, 16, 32, 64, 128, 384]) {
		const length = 384 / denominator
		while (ticks >= length) {
			result.push(denominator)
			ticks -= length
		}
	}
	return result
}

/** Core MML performance export; parallel parts, @ programs and @v MIDI velocity. */
export function createMMLFromAudioEventRecording(
	recording: NoteRecording,
	timer: { readonly BPM: number }
): string {
	const bpm = Math.round(exportTempo(timer))
	if (bpm < 1 || bpm > 1000) {
		throw new Error("MML tempo must be 1–1000 BPM")
	}
	const voices = recordingVoices(recording)
	if (!voices.length) {
		throw new Error("Record some notes before exporting MML")
	}
	if (voices.length > 16) {
		throw new Error("MML export supports at most 16 parallel parts")
	}
	const toTicks = (seconds: number) => Math.round(((seconds * bpm) / 60) * 96)
	return (
		voices
			.map((notes) => {
				let cursor = 0
				const tokens = [`t${bpm}`, "q8"]
				for (const note of notes) {
					const start = Math.max(cursor, toTicks(note.start))
					const duration = Math.max(1, toTicks(note.start + note.duration) - start)
					if (start + duration > ((1800 * bpm) / 60) * 96) {
						throw new Error("MML export exceeds 30 minutes")
					}
					for (const denominator of lengths(start - cursor)) {
						tokens.push(`r${denominator}`)
					}
					tokens.push(
						`@${note.patch}`,
						`@v${note.velocity}`,
						lengths(duration)
							.map((denominator) => `l${denominator} n${note.number}`)
							.join(" & ")
					)
					cursor = start + duration
				}
				return tokens.join(" ")
			})
			.join(";\n") + ";\n"
	)
}