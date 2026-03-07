
/**
 * Convert dB to linear (0-1)
 */
export const dbToLinear = (value: number): number => {
	if (value <= 0) return 0
	return Math.pow(10, value / 20)
}