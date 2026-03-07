/**
 * Convert linear (0-1) to dB
 */
export const linearToDb = (value: number): number => {
	if (value <= 0) return -Infinity
	return 20 * Math.log10(value)
}