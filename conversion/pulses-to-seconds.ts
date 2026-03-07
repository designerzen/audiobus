import { QUARTER } from './constants'

/**
 * Convert pulses to seconds at a given BPM
 * @param pulses Pulses (PPQN units)
 * @param bpm Beats per minute
 * @returns Time in seconds
 */
export const pulsesToSeconds = (pulses: number, bpm: number): number => (pulses * 60.0 / QUARTER) / bpm
