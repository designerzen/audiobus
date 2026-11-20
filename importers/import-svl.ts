import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import type { SequenceNote } from "../formats/note-sequence"

/** Sonic Visualiser note layers; frame times use each model's sample rate. */
export async function importSVLFile(file: File) {
	checkMusicFile(file)
	const text = (await file.text()).replace(/<!DOCTYPE\s+(?:sv|sonic-visualiser)\s*>/i, "")
	if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
		throw new Error("SVL external document types and entities are unsupported")
	}
	const doc = new DOMParser().parseFromString(text, "application/xml")
	if (doc.querySelector("parsererror") || doc.documentElement.localName !== "sv") {
		throw new Error("Expected a Sonic Visualiser XML layer")
	}
	const notes: SequenceNote[] = []
	const models = [...doc.querySelectorAll('model[subtype="note"], model[subtype="flexinote"]')]
	for (const [index, model] of models.entries()) {
		const sampleRate = Number(model.getAttribute("sampleRate"))
		if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
			throw new Error("Invalid SVL sample rate")
		}
		const dataset = [...doc.querySelectorAll("dataset")].find(
			(data) => data.getAttribute("id") === model.getAttribute("dataset")
		)
		if (!dataset) {
			throw new Error("SVL note model is missing its dataset")
		}
		for (const point of dataset.querySelectorAll("point")) {
			if (notes.length >= 100000) {
				throw new Error("SVL contains too many notes")
			}
			const value = Number(point.getAttribute("value") ?? NaN)
			const pitch =
				model.getAttribute("units")?.toLowerCase() === "hz"
					? 69 + 12 * Math.log2(value / 440)
					: value
			const level = Number(point.getAttribute("level") ?? 100 / 127)
			if (!Number.isFinite(level) || level < 0 || level > 1) {
				throw new Error("Invalid SVL note level")
			}
			notes.push({
				number: Math.round(pitch),
				start: Number(point.getAttribute("frame") ?? NaN) / sampleRate,
				duration: Number(point.getAttribute("duration") ?? NaN) / sampleRate,
				velocity: Math.round(level * 127),
				channel: (index % 16) + 1,
				patch: 0
			})
		}
	}
	return commandsFromNotes(notes, file.name)
}