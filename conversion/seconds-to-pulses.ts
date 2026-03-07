import { QUARTER } from './constants'

/**
 * Convert seconds to pulses at a given BPM
 * @param seconds Time in seconds
 * @param bpm Beats per minute
 * @returns Number of pulses (PPQN units)
 */
export const secondsToPulses = (seconds: number, bpm: number): number => seconds * bpm / 60 * QUARTER
