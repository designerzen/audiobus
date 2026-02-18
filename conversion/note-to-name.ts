
/**
 * Convert MIDI note number (0-127) to note name (C-1, C0, ..., G9)
 */

import { noteNumberToKeyName } from "./note-to-key-name"
import { noteNumberToOctave } from "./note-to-octave"

const noteNumberToNameCache = new Map<number, string>()
export const noteNumberToName = (noteNumber: number): string =>  {
	if (noteNumberToNameCache.has(noteNumber)) {
		return noteNumberToNameCache.get(noteNumber)!
	}
	const name = `${noteNumberToKeyName(noteNumber)}${noteNumberToOctave(noteNumber)}`
	noteNumberToNameCache.set(noteNumber, name)
	return name
}
