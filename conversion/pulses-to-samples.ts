import type { bpm, ppqn } from './types'
import { pulsesToSeconds } from './pulses-to-seconds'

/**
 * Convert pulses to samples at a given BPM and sample rate
 * @param pulses Pulses (PPQN units)
 * @param bpm Beats per minute
 * @param sampleRate Sample rate in Hz (e.g., 44100)
 * @returns Number of audio samples
 */
export const pulsesToSamples = (pulses: ppqn, bpm: bpm, sampleRate: number): number => pulsesToSeconds(pulses, bpm) * sampleRate
