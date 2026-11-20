import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import type { SequenceNote } from "../formats/note-sequence"

/** UST melody and rests at 480 ticks per quarter; note-local tempos persist. */
export async function importUSTFile(file: File) {
	checkMusicFile(file)
	const bytes = new Uint8Array(await file.arrayBuffer())
	const preview = new TextDecoder().decode(bytes.subarray(0, 4096))
	const text = new TextDecoder(
		/Charset\s*=\s*UTF-?8/i.test(preview) ? "utf-8" : "shift-jis"
	).decode(bytes)
	if (!/\[#SETTING\]/i.test(text)) {
		throw new Error("Expected a UTAU UST settings section")
	}
	const blocks = [...text.matchAll(/^\[#([^\]\r\n]+)\]\s*\r?\n([\s\S]*?)(?=^\[#|$(?![\s\S]))/gm)]
	if (blocks.length > 100004) {
		throw new Error("UST contains too many sections")
	}
	const fields = (body: string) =>
		Object.fromEntries(
			body
				.split(/\r?\n/)
				.filter((line) => line.includes("="))
				.map((line) => {
					const at = line.indexOf("=")
					return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
				})
		)
	const setting = fields(blocks.find((block) => block[1].toUpperCase() === "SETTING")?.[2] ?? "")
	let tempo = Number(setting.Tempo ?? 120),
		start = 0
	const notes: SequenceNote[] = []
	for (const block of blocks) {
		if (!/^\d+$/.test(block[1])) {
			continue
		}
		const values = fields(block[2])
		if (values.Tempo) {
			tempo = Number(values.Tempo)
		}
		const length = Number(values.Length)
		if (!Number.isFinite(tempo) || tempo <= 0 || !Number.isInteger(length) || length <= 0) {
			throw new Error("Invalid UST tempo or note length")
		}
		const duration = ((length / 480) * 60) / tempo
		if (values.Lyric?.toUpperCase() !== "R") {
			const intensity = Number(values.Intensity ?? 100)
			if (!Number.isFinite(intensity) || intensity < 0 || intensity > 200) {
				throw new Error("Invalid UST intensity")
			}
			notes.push({
				number: Number(values.NoteNum),
				start,
				duration,
				velocity: Math.round((Math.min(100, intensity) * 127) / 100),
				channel: 1,
				patch: 0
			})
		}
		start += duration
		if (start > 1800) {
			throw new Error("UST exceeds 30 minutes")
		}
	}
	return commandsFromNotes(notes, file.name)
}