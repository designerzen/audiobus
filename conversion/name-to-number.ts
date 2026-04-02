import { convertNoteLetterToSemitone } from "./note-to-semitone"

const cache = new Map()

/**
 * Convert note name to MIDI note number
 * 
 * Supports formats:
 * - Scientific: C4, D#5, Bb2 (where middle C is C4 = 60)
 * - With flats: Db, Eb, etc.
 * - Enharmonic equivalents: C# = Db, F# = Gb, etc.
 * 
 * @param {String} name - note name (e.g., "C4", "D#5", "Bb2")
 * @return {Number} MIDI note number (0-127), or undefined if invalid
 */
export const convertNoteNameToMIDINoteNumber = (name: string): number | undefined => {
	
	if (cache.has(name))
	{
		return cache.get(name)
	}

	if (!name || typeof name !== 'string'){ 
		return undefined
	}

	const normalized = name.trim().toUpperCase()
	const match = normalized.match(/^([A-G])([#♯b♭]?)(-?\d+)$/)

	if (!match){
		return undefined
	}

	const [, noteLetter, accidental, octaveStr] = match
	const octave = parseInt(octaveStr, 10)

	let semitone = convertNoteLetterToSemitone(noteLetter)
	if (semitone === undefined)
	{ 
		return undefined
	}

	// Apply accidental
	if (accidental === '#' || accidental === '♯') {
		semitone += 1
	} else if (accidental === 'b' || accidental === '♭') {
		semitone -= 1
	}

	// Clamp semitone to valid range
	semitone = semitone % 12
	if (semitone < 0) 
	{
		semitone += 12
	}

	// Calculate MIDI note: (octave + 1) * 12 + semitone
	// where C-1 = 0, C0 = 12, C4 = 60
	const midiNumber = (octave + 1) * 12 + semitone
	const limited = midiNumber >= 0 && midiNumber <= 127 ? midiNumber : undefined

	cache.set( name, limited )

	// Validate range (MIDI 0-127)
	return limited
}

// if you run this ahead of time it will speed up the app via precaching
export const precacheNotes = () => {

}