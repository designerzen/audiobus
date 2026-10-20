/** One sixteenth-note boundary from the shared transport, in audio seconds. */
export interface AudioClockTick {
	step: number
	bpm: number
	triggerAt: number
	stepDuration: number
}