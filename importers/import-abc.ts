import { songFromCommands } from "../formats/song-source"
import { keySignature } from "../formats/song-midi"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { MAX_MEDIA_BYTES } from "./dropped-media"

/** ABC score import through abcjs's performance model, including repeats and tuplets.
 * Voices use the MIDI channels assigned by abcjs; engraving is not retained.
 */
export async function importABCFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("ABC file exceeds the 64 MB limit")
	}
	const text = await file.text()
	if (!/^K:/m.test(text)) {
		throw new Error("Expected ABC notation with a K: key header")
	}
	const { default: abcjs } = await import("abcjs")
	const tunes = abcjs.parseOnly(text)
	if (tunes.length !== 1) {
		throw new Error("Import one ABC tune at a time")
	}
	const audio = tunes[0].setUpAudio({})
	if (!Number.isFinite(audio.tempo) || audio.tempo <= 0) {
		throw new Error("Invalid ABC tempo")
	}
	const scale = 240 / audio.tempo
	const commands: AudioCommand[] = []
	let noteCount = 0
	for (const [index, track] of audio.tracks.entries()) {
		let channel = index + 1
		for (const item of track) {
			if (item.cmd === "program") {
				channel = item.channel + 1
			}
			if (item.cmd !== "note" || item.volume <= 0) {
				continue
			}
			if (!Number.isInteger(item.pitch) || item.pitch < 0 || item.pitch > 127) {
				throw new Error("ABC pitch is outside MIDI note support")
			}
			if (item.instrument === 128) {
				channel = 10
			}
			if (channel < 1 || channel > 16) {
				throw new Error("ABC imports support at most 16 MIDI channels")
			}
			const startAt = item.start * scale,
				endAt = startAt + Math.max(0.001, item.duration * scale - (item.gap ?? 0))
			const from = `${file.name}:voice-${index + 1}`,
				patch = item.instrument === 128 ? 0 : item.instrument
			commands.push(
				Object.assign(new AudioCommand(), {
					type: NOTE_ON,
					number: item.pitch,
					channel,
					patch,
					startAt,
					endAt,
					velocity: Math.max(1, Math.min(127, Math.round(item.volume))),
					from
				}),
				Object.assign(new AudioCommand(), {
					type: NOTE_OFF,
					number: item.pitch,
					channel,
					patch,
					startAt: endAt,
					velocity: 0,
					from
				})
			)
			noteCount++
		}
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : b.type === NOTE_OFF ? 1 : 0)
	)
	if (!noteCount) {
		throw new Error("The ABC tune contains no importable notes")
	}
	// Header metadata is optional; unusual meters and modes fall back to the defaults.
	const meter = /^M:\s*(?:(\d+)\/(\d+)|(C\|?))/m.exec(text)
	const [numerator, denominator] = meter?.[3]
		? meter[3] === "C"
			? [4, 4]
			: [2, 2]
		: [Number(meter?.[1]), Number(meter?.[2])]
	const key = /^K:\s*([A-G][#b]?)\s*(maj(?:or)?|min(?:or)?|m)?(?![a-z])/im.exec(text)
	const minor = /^m(?:in)?/i.test(key?.[2] ?? "") && !/^maj/i.test(key?.[2] ?? "")
	const song = songFromCommands(commands, /^T:\s*(.+)/m.exec(text)?.[1].trim() || file.name, {
		tempos: [{ time: 0, bpm: audio.tempo }],
		meters:
			Number.isInteger(numerator) &&
			numerator >= 1 &&
			numerator <= 64 &&
			[1, 2, 4, 8, 16, 32, 64].includes(denominator)
				? [{ time: 0, numerator, denominator }]
				: [],
		key: key
			? keySignature(key[1][0].toUpperCase() + key[1].slice(1), minor ? "minor" : "major")
			: undefined
	})
	return { commands, noteCount, song }
}