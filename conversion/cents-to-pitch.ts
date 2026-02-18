/**
 * Convert cents to MIDI 2.0 pitch (32-bit fixed point)
 * 0x80000000 = center (no transposition)
 * Each semitone = 0x00800000
 * @param cents 
 * @returns 
 */
export const centsToPitch = (cents: number): number => {
	const semitones = cents / 100
	const pitchValue = 0x80000000 + Math.round(semitones * 0x00800000)
	return pitchValue >>> 0 // Ensure unsigned
}
