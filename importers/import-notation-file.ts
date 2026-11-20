import { importMIDIBytes } from "./import-midi-file"
import { MAX_MEDIA_BYTES } from "./dropped-media"

/** Guitar Pro 3–8, Capella CAPX and alphaTex notes via alphaTab's headless core. */
export async function importNotationFile(file: File, alphaTex = false) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("Notation file exceeds the 64 MB limit")
	}
	const { importer, midi, Settings } = await import("@coderline/alphatab/core")
	const settings = new Settings()
	let score
	if (alphaTex) {
		const parser = new importer.AlphaTexImporter()
		parser.logErrors = false
		parser.initFromString(await file.text(), settings)
		score = parser.readScore()
	} else {
		score = importer.ScoreLoader.loadScoreFromBytes(
			new Uint8Array(await file.arrayBuffer()),
			settings
		)
	}
	const output = new midi.MidiFile()
	const generator = new midi.MidiFileGenerator(
		score,
		settings,
		new midi.AlphaSynthMidiFileHandler(output, true)
	)
	generator.generate()
	const result = importMIDIBytes(Uint8Array.from(output.toBinary()).buffer, file.name)
	if (!result.noteCount) {
		throw new Error("The notation file contains no importable notes")
	}
	return result
}