/// <reference path="./essentia-modules.d.ts" />
/**
 * Music information retrieval with Essentia (https://essentia.upf.edu)
 *
 * Pure functions over an Essentia instance so they run in the analysis worker
 * and in Node tests alike. Essentia vectors live on the WASM heap: every vector
 * created or returned here is deleted before returning.
 *
 * Essentia and essentia.js are AGPL-3.0 licensed.
 */
import type Essentia from "essentia.js/dist/essentia.js-core.es.js"

/** RhythmExtractor2013 only supports this rate, so whole-track analysis uses it throughout. */
export const ANALYSIS_SAMPLE_RATE = 44100

export type ScaleName = "major" | "minor"

export interface TrackAnalysis {
	duration: number
	bpm: number
	/** RhythmExtractor2013 confidence: 0–1 poor, 1–1.5 fair, 1.5–3.5 good, above 3.5 excellent. */
	bpmConfidence: number
	/** Beat positions in seconds. */
	beats: number[]
	/** Tonic pitch class, 0 = C. */
	key: number
	keyName: string
	scale: ScaleName
	/** 0–1 */
	keyStrength: number
	/** Integrated EBU R128 loudness in LUFS. */
	loudness: number
	/** Loudness range in LU. */
	loudnessRange: number
	/** Usually 0–3; higher is more danceable. */
	danceability: number
}

export type FrameFeatureName = "pitch" | "onset" | "chroma" | "spectral"

export interface FrameFeatures {
	/** Seconds since the stream started, at the frame start. */
	time: number
	rms: number
	pitch?: { frequency: number; confidence: number }
	onset?: { strength: number; detected: boolean }
	/** 12 bins starting at C, normalised so the largest is 1. */
	chroma?: number[]
	spectral?: {
		/** Spectral centroid normalised to 0–1 of Nyquist. */
		centroid: number
		/** Half-rectified spectral flux against the previous frame. */
		flux: number
		/** Steven's power-law loudness of the frame. */
		loudness: number
		mfcc: number[]
	}
}

export interface FrameAnalyserOptions {
	sampleRate: number
	frameSize?: number
	features: FrameFeatureName[]
	/** Onset threshold as a multiple of the recent median detection value. */
	onsetThreshold?: number
	pitchMinFrequency?: number
	pitchMaxFrequency?: number
}

export interface FrameAnalyser {
	analyse(frame: Float32Array, time: number): FrameFeatures
	dispose(): void
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

/** Pitch class for an Essentia key name such as "Bb" or "F#"; -1 when unknown. */
export function pitchClassFromName(name: string): number {
	const sharp = SHARP_NAMES.indexOf(name)
	return sharp >= 0 ? sharp : FLAT_NAMES.indexOf(name)
}

export function mixToMono(channels: Float32Array[]): Float32Array {
	if (channels.length === 1) {
		return channels[0]
	}
	const mono = new Float32Array(channels[0]?.length ?? 0)
	for (const channel of channels) {
		for (let i = 0; i < mono.length; i++) {
			mono[i] += channel[i] / channels.length
		}
	}
	return mono
}

function finite(value: unknown, fallback = 0): number {
	const number = Number(value)
	return Number.isFinite(number) ? number : fallback
}

/** Tempo, beats, key, loudness and danceability of a whole track at ANALYSIS_SAMPLE_RATE. */
export function analyseTrack(essentia: Essentia, channels: Float32Array[]): TrackAnalysis {
	const mono = mixToMono(channels)
	const signal = essentia.arrayToVector(mono)
	const left = essentia.arrayToVector(channels[0])
	const right = channels[1] ? essentia.arrayToVector(channels[1]) : left
	const owned: EssentiaVector[] = [signal, left]
	if (right !== left) {
		owned.push(right)
	}
	try {
		const rhythm = essentia.RhythmExtractor2013(signal, 208, "multifeature", 40)
		owned.push(rhythm.ticks, rhythm.estimates, rhythm.bpmIntervals)
		const key = essentia.KeyExtractor(
			signal,
			true,
			4096,
			4096,
			12,
			3500,
			60,
			25,
			0.2,
			"bgate",
			ANALYSIS_SAMPLE_RATE
		)
		const dance = essentia.Danceability(signal, 8800, 310, ANALYSIS_SAMPLE_RATE, 1.1)
		owned.push(dance.dfa)
		const loudness = essentia.LoudnessEBUR128(left, right, 0.1, ANALYSIS_SAMPLE_RATE, false)
		owned.push(loudness.momentaryLoudness, loudness.shortTermLoudness)
		const pitchClass = pitchClassFromName(String(key.key))
		return {
			duration: mono.length / ANALYSIS_SAMPLE_RATE,
			bpm: finite(rhythm.bpm),
			bpmConfidence: finite(rhythm.confidence),
			beats: Array.from(essentia.vectorToArray(rhythm.ticks)),
			key: Math.max(0, pitchClass),
			keyName: SHARP_NAMES[Math.max(0, pitchClass)],
			scale: key.scale === "minor" ? "minor" : "major",
			keyStrength: finite(key.strength),
			loudness: finite(loudness.integratedLoudness, -70),
			loudnessRange: finite(loudness.loudnessRange),
			danceability: finite(dance.danceability)
		}
	} finally {
		for (const vector of owned) {
			vector?.delete?.()
		}
	}
}

/** Frame-by-frame features for live input; keeps flux and onset history between frames. */
export function createFrameAnalyser(
	essentia: Essentia,
	options: FrameAnalyserOptions
): FrameAnalyser {
	const { sampleRate, features } = options
	const frameSize = options.frameSize ?? 2048
	const want = new Set(features)
	const nyquist = sampleRate / 2
	const zeroPhase = essentia.arrayToVector(new Float32Array(frameSize / 2 + 1))
	const history: number[] = []
	let previousSpectrum: Float32Array | undefined
	let previousOnset = 0

	return {
		analyse(frame, time) {
			const owned: EssentiaVector[] = []
			const keep = <T extends EssentiaVector>(vector: T): T => {
				owned.push(vector)
				return vector
			}
			try {
				const signal = keep(essentia.arrayToVector(frame))
				const result: FrameFeatures = { time, rms: finite(essentia.RMS(signal).rms) }
				if (want.has("pitch")) {
					const pitch = essentia.PitchYin(
						signal,
						frameSize,
						true,
						options.pitchMaxFrequency ?? 2000,
						options.pitchMinFrequency ?? 50,
						sampleRate,
						0.15
					)
					result.pitch = {
						frequency: finite(pitch.pitch),
						confidence: finite(pitch.pitchConfidence)
					}
				}
				if (want.has("onset") || want.has("chroma") || want.has("spectral")) {
					const windowed = keep(
						essentia.Windowing(signal, true, frameSize, "hann", 0, true).frame
					)
					const spectrum = keep(essentia.Spectrum(windowed, frameSize).spectrum)
					if (want.has("onset")) {
						const strength = finite(
							essentia.OnsetDetection(spectrum, zeroPhase, "hfc", sampleRate)
								.onsetDetection
						)
						const sorted = [...history].sort((a, b) => a - b)
						const median = sorted[Math.floor(sorted.length / 2)] ?? 0
						const threshold = median * (options.onsetThreshold ?? 2.5) + 1e-3
						// Report only the rising edge so one attack is one onset
						const detected =
							history.length >= 4 &&
							strength > threshold &&
							previousOnset <= threshold
						previousOnset = strength
						history.push(strength)
						if (history.length > 32) {
							history.shift()
						}
						result.onset = { strength, detected }
					}
					if (want.has("chroma")) {
						const peaks = essentia.SpectralPeaks(
							spectrum,
							0.0001,
							5000,
							60,
							40,
							"magnitude",
							sampleRate
						)
						keep(peaks.frequencies)
						keep(peaks.magnitudes)
						const hpcp = keep(
							essentia.HPCP(
								peaks.frequencies,
								peaks.magnitudes,
								true,
								500,
								0,
								5000,
								false,
								40,
								false,
								"unitMax",
								440,
								sampleRate,
								12,
								"squaredCosine",
								1
							).hpcp
						)
						const bins = essentia.vectorToArray(hpcp)
						// HPCP bin 0 is the reference A; rotate so bin 0 is C
						result.chroma = Array.from({ length: 12 }, (_, pc) =>
							finite(bins[(pc + 3) % 12])
						)
					}
					if (want.has("spectral")) {
						const magnitudes = essentia.vectorToArray(spectrum)
						let flux = 0
						if (previousSpectrum) {
							for (let i = 0; i < magnitudes.length; i++) {
								flux += Math.max(0, magnitudes[i] - previousSpectrum[i])
							}
						}
						previousSpectrum = magnitudes
						const mfcc = essentia.MFCC(
							spectrum,
							2,
							Math.min(11000, nyquist),
							frameSize / 2 + 1,
							0,
							"dbamp",
							0,
							"unit_sum",
							40,
							13,
							sampleRate
						)
						keep(mfcc.bands)
						keep(mfcc.mfcc)
						result.spectral = {
							centroid:
								finite(essentia.Centroid(spectrum, nyquist).centroid) / nyquist,
							flux,
							loudness: finite(essentia.Loudness(signal).loudness),
							mfcc: Array.from(essentia.vectorToArray(mfcc.mfcc))
						}
					}
				}
				return result
			} finally {
				for (const vector of owned) {
					vector?.delete?.()
				}
			}
		},
		dispose() {
			zeroPhase.delete()
			previousSpectrum = undefined
		}
	}
}