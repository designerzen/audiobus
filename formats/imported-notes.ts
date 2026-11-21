import { songFromCommands, type SongMetadata } from "./song-source"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import type { SequenceNote } from "./note-sequence"
import { MAX_MEDIA_BYTES } from "../importers/dropped-media"

export function checkMusicFile(file: File) {
	if (!file.size || file.size > MAX_MEDIA_BYTES) {
		throw new Error("Choose a nonempty music file up to 64 MB")
	}
}

/** Validate interchange data before creating playable commands. Times are seconds. */
export function commandsFromNotes(notes: SequenceNote[], name: string, meta: SongMetadata = {}) {
	if (!notes.length || notes.length > 100000) {
		throw new Error("Expected between 1 and 100,000 notes")
	}
	const commands: AudioCommand[] = []
	for (const note of notes) {
		if (
			![note.number, note.channel, note.patch, note.velocity].every(Number.isInteger) ||
			note.number < 0 ||
			note.number > 127 ||
			note.channel < 1 ||
			note.channel > 16 ||
			note.patch < 0 ||
			note.patch > 127 ||
			note.velocity < 0 ||
			note.velocity > 127 ||
			!Number.isFinite(note.start) ||
			!Number.isFinite(note.duration) ||
			note.start < 0 ||
			note.duration <= 0 ||
			note.start + note.duration > 1800
		) {
			throw new Error(
				"Invalid note: expected MIDI pitch, channel, program and velocity, with positive duration within 30 minutes"
			)
		}
		if (!note.velocity) {
			continue
		}
		const common = { number: note.number, channel: note.channel, patch: note.patch, from: name }
		commands.push(
			Object.assign(new AudioCommand(), common, {
				type: NOTE_ON,
				startAt: note.start,
				endAt: note.start + note.duration,
				velocity: note.velocity
			}),
			Object.assign(new AudioCommand(), common, {
				type: NOTE_OFF,
				startAt: note.start + note.duration,
				velocity: 0
			})
		)
	}
	if (!commands.length) {
		throw new Error("Music file contains no audible notes")
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : b.type === NOTE_OFF ? 1 : 0)
	)
	return {
		commands,
		noteCount: commands.length / 2,
		song: songFromCommands(commands, name, meta)
	}
}