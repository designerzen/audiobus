import type { bpm, ppqn, seconds } from './types'
import { QUARTER } from './constants'

/**
 * Convert pulses to seconds at a given BPM
 * @param pulses Pulses (PPQN units)
 * @param bpm Beats per minute
 * @returns Time in seconds
 */
export const pulsesToSeconds = (pulses: ppqn, bpm: bpm): seconds => (pulses * 60.0 / QUARTER) / bpm
