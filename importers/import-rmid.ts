import { checkMusicFile } from "../formats/imported-notes"
import { importMIDIBytes } from "./import-midi-file"

export async function importRMIDFile(file: File) {
	checkMusicFile(file)
	const bytes = new Uint8Array(await file.arrayBuffer()),
		view = new DataView(bytes.buffer)
	const tag = (at: number) => new TextDecoder().decode(bytes.subarray(at, at + 4))
	if (bytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "RMID") {
		throw new Error("Expected a RIFF MIDI container")
	}
	const end = view.getUint32(4, true) + 8
	if (end !== bytes.length) {
		throw new Error("Invalid RIFF MIDI container length")
	}
	for (let at = 12; at < end; ) {
		if (at + 8 > end) {
			throw new Error("Truncated RIFF MIDI chunk")
		}
		const size = view.getUint32(at + 4, true),
			next = at + 8 + size + (size % 2)
		if (next > end) {
			throw new Error("Truncated RIFF MIDI data")
		}
		if (tag(at) === "data") {
			if (tag(at + 8) !== "MThd") {
				throw new Error("RIFF MIDI data is missing a MIDI header")
			}
			return importMIDIBytes(bytes.slice(at + 8, at + 8 + size).buffer, file.name)
		}
		at = next
	}
	throw new Error("RIFF MIDI container has no data chunk")
}