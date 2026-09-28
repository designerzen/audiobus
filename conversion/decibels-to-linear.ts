
/**
 * Convert dB to linear (0-1)
 */
export const dbToLinear = (value: number): number => {
	return Math.pow(10, value / 20)
}