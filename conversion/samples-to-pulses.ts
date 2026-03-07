import { secondsToPulses } from './seconds-to-pulses'

/**
 * Convert samples to pulses at a given BPM and sample rate
 * @param samples Audio samples
 * @param bpm Beats per minute
 * @param sampleRate Sample rate in Hz (e.g., 44100)
 * @returns Number of pulses (PPQN units)
 */
export const samplesToPulses = (samples: number, bpm: number, sampleRate: number): number => secondsToPulses(samples / sampleRate, bpm)
