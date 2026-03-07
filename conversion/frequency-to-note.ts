import { frequencyToSemitones } from "./frequency-to-semitones"

/**
 * Convert frequency (Hz) to MIDI note number
 * A4 = 440 Hz = MIDI note 69
 */
export const frequencyToNote = (frequency: number, offset:number=69): number =>{
	if (frequency <= 0) return 0
	const semitones:number = frequencyToSemitones(frequency)
	const midiNote = Math.round(offset + semitones)
	return Math.max(0, Math.min(127, midiNote))
}

/**
 * Convert frequency to MIDI note with cents (for fine control)
 */
export const frequencyToNoteCents = (frequency: number, offset:number=69 ): { note: number; cents: number } => {
	if (frequency <= 0) return { note: 0, cents: 0 }
	const semitones:number = frequencyToSemitones(frequency)
	const note = Math.round(offset + semitones)
	const cents = (semitones - Math.round(semitones)) * 100
	return {
		note: Math.max(0, Math.min(127, note)),
		cents: cents
	}
}
