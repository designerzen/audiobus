export const frequencyToSemitones = (frequency:number):number => {
	return 12 * Math.log2(frequency / 440)
}
