import { Ticks } from "./constants"

/**
 * Converts seconds to ticks at a given bpm.
 * Uses internal tick resolution where 3840 ticks = 1 quarter note
 * @param seconds Time in seconds
 * @param bpm Beats per minute
 * @param resolution Optional: ticks per quarter note (default: 3840)
 * @returns Number of ticks (internal timing units)
 */
export const secondsToTicks = (seconds: number, bpm: number, resolution: number = Ticks.Beat ): number => {
    const quarterNoteDurationSeconds = 60 / bpm
    const ticksPerSecond = resolution / quarterNoteDurationSeconds
    return seconds * ticksPerSecond
}
