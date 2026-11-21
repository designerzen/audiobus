import { songNotes, songVoices, type SongSource } from "./song-source"
import type RecorderAudioEvent from "../events/audio-event-recorder"
import type { IAudioCommand } from "../commands/audio-command-interface"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"

export type NoteRecording = Pick<RecorderAudioEvent, "duration" | "name"> & {
	events: IAudioCommand[]
	song?: SongSource
}
export interface SequenceNote {
	source?: string
	/** IO chain that played the note, which identifies its timbre */
	chainId?: string
	number: number
	channel: number
	patch: number
	velocity: number
	start: number
	duration: number
}
export const exportTempo = (timer: { readonly BPM: number }) => {
	if (!Number.isFinite(timer.BPM) || timer.BPM <= 0) {
		throw new Error("Export requires a positive, finite tempo")
	}
	return timer.BPM
}
export const escapeXML = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!
	)

/** Pair notes by source, chain, input, channel and pitch; never mutate the recorder.
 * Recording timestamps use the audio clock. Export starts at the first recorded note.
 */
export function recordingNotes(
	recording: NoteRecording,
	options: { sources?: boolean; chains?: boolean } = {}
): SequenceNote[] {
	// A song keeps its own times, including any leading silence.
	if (recording.song) {
		return songNotes(recording.song).map(({ source, chainId, ...note }) => ({
			...(options.sources && source ? { source } : {}),
			...(options.chains && chainId ? { chainId } : {}),
			...note
		}))
	}
	const pending = new Map<string, IAudioCommand[]>()
	const completed: { event: IAudioCommand; end: number }[] = []
	const events: IAudioCommand[] = recording.events
		.filter((e) => Number.isFinite(e.startAt))
		.slice()
		.sort((a, b) => a.startAt - b.startAt)
	for (const event of events) {
		if (!Number.isInteger(event.number) || event.number < 0 || event.number > 127) {
			continue
		}
		const key = JSON.stringify([
			event.chainId,
			event.inputId,
			event.from,
			event.channel,
			event.number
		])
		if (event.type === NOTE_OFF || (event.type === NOTE_ON && event.velocity === 0)) {
			const on = pending.get(key)?.shift()
			if (on) {
				completed.push({ event: on, end: event.startAt })
			}
		} else if (
			event.type === NOTE_ON &&
			event.velocity > 0 &&
			Number.isFinite(event.velocity)
		) {
			const queue = pending.get(key) ?? []
			queue.push(event)
			pending.set(key, queue)
		}
	}
	for (const queue of pending.values()) {
		for (const event of queue) {
			const end = event.endAt > event.startAt ? event.endAt : recording.duration
			completed.push({
				event,
				end: Number.isFinite(end) && end > event.startAt ? end : event.startAt + 0.1
			})
		}
	}
	completed.sort((a, b) => a.event.startAt - b.event.startAt)
	const origin = completed[0]?.event.startAt ?? 0
	return completed
		.filter(({ event, end }) => end > event.startAt)
		.map(({ event, end }) => ({
			...(options.sources && event.from ? { source: event.from } : {}),
			...(options.chains && event.chainId ? { chainId: event.chainId } : {}),
			number: event.number,
			channel:
				Number.isInteger(event.channel) && event.channel >= 1 && event.channel <= 16
					? event.channel
					: 1,
			patch: Math.max(
				0,
				Math.min(127, Math.round((event as IAudioCommand & { patch?: number }).patch ?? 0))
			),
			velocity: Math.max(1, Math.min(127, Math.round(event.velocity))),
			start: event.startAt - origin,
			duration: end - event.startAt
		}))
}
/** Separate overlapping notes into monophonic voices, retaining channel/program groups. */
export function recordingVoices(recording: NoteRecording): SequenceNote[][] {
	if (recording.song) {
		return songVoices(recording.song)
	}
	const voices: SequenceNote[][] = []
	for (const note of recordingNotes(recording)) {
		let voice = voices.find((candidate) => {
			const last = candidate.at(-1)!
			return (
				last.channel === note.channel &&
				last.patch === note.patch &&
				last.start + last.duration <= note.start + 1e-9
			)
		})
		if (!voice) {
			voice = []
			voices.push(voice)
		}
		voice.push(note)
	}
	return voices
}