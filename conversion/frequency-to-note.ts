/**
 * Convert frequency (Hz) to MIDI note number
 * A4 = 440 Hz = MIDI note 69
 */
export const frequencyToNote = (frequency: number): number =>{
	if (frequency <= 0) return 0
	const semitones = 12 * Math.log2(frequency / 440)
	const midiNote = Math.round(69 + semitones)
	return Math.max(0, Math.min(127, midiNote))
}

/**
 * Convert frequency to MIDI note with cents (for fine control)
 */
export const frequencyToNoteCents = (frequency: number): { note: number; cents: number } => {
	if (frequency <= 0) return { note: 0, cents: 0 }
	const semitones = 12 * Math.log2(frequency / 440)
	const note = Math.round(69 + semitones)
	const cents = (semitones - Math.round(semitones)) * 100
	return {
		note: Math.max(0, Math.min(127, note)),
		cents: cents
	}
}
