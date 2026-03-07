import { QUARTER } from './constants'

/**
 * Calculate BPM from a duration and pulse count
 * @param seconds Time in seconds
 * @param pulses Pulses (PPQN units)
 * @returns Beats per minute
 */
export const secondsToBpm = (seconds: number, pulses: number): number => (pulses * 60.0 / QUARTER) / seconds
