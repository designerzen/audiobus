/**
 * Convert MIDI 2.0 pitch to cents
 * 
 * @param pitch 
 * @returns 
 */
export const pitchToCents = (pitch: number): number => {
	const offset = (pitch | 0) - 0x80000000
	const semitones = offset / 0x00800000
	return semitones * 100
}
