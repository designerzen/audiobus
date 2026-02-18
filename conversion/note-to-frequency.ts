const noteToFrequencyMap = new Map()
const ROOT_FREQUENCY = 440 //frequency of A (coomon value is 440Hz)
const ROOT_F_BY_32 = ROOT_FREQUENCY / 32
export const noteNumberToFrequency = (noteNumber:number, quantityOfNotes:number=12) =>{

	if (!Number.isFinite(noteNumber)) {
		throw Error("Invalid note number: " + noteNumber)
	}

	if (noteToFrequencyMap.has(noteNumber))
	{
		return noteToFrequencyMap.get(noteNumber)
	}
	const frequency = ROOT_F_BY_32 * (2 ** ((noteNumber - 9) / quantityOfNotes))
	noteToFrequencyMap.set(noteNumber, frequency)
	return frequency
}


/**
 * Convert MIDI note number to frequency in Hz
 */
export const midiNoteToFrequency = (noteNumber: number): number => {
	return 440 * (2 ** (noteNumber - 69) / 12)
}
