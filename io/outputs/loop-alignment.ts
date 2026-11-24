import type { LoopPlayerSettings } from "./loop-player-settings"

/** What audio analysis found, as far as a Loop Player keeps it (saved with the device). */
export interface DetectedLoop {
	bpm: number
	/** RhythmExtractor2013 confidence: 0–1 poor, 1–1.5 fair, 1.5–3.5 good, above 3.5 excellent */
	bpmConfidence?: number
	/** Tonic pitch class, 0 = C */
	key?: number
	keyName?: string
	scale?: "major" | "minor"
	keyStrength?: number
}

/** Analysis input for aligning a loop: the detected tempo and, when known, beat times in seconds. */
export interface LoopAlignmentSource {
	bpm: number
	beats?: readonly number[]
}

export type LoopRegion = Pick<LoopPlayerSettings, "start" | "end" | "loopBeats">

/** Loop lengths that repeat as whole bars without a seam, longest first. */
const LOOP_BEATS = [32, 16, 8, 4]
/** A tracker often places the first beat just after the true start, so a loop may overrun by this many beats. */
const OVERRUN_BEATS = 0.25

/**
 * Start the loop on the first detected beat and choose a whole number of beats so that
 * (60 × loopBeats) / (end − start) equals the detected tempo. Prefers 4, 8, 16 or 32 beats.
 * The end never passes the audio, so a file that is a hair short plays at a hair off the tempo.
 * Returns undefined when the audio holds less than one beat after the first.
 */
export function alignLoopToBeats(
	{ bpm, beats = [] }: LoopAlignmentSource,
	duration: number
): LoopRegion | undefined {
	if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(duration) || duration <= 0) {
		return undefined
	}
	const start = beats.find((beat) => Number.isFinite(beat) && beat >= 0 && beat < duration) ?? 0
	const available = ((duration - start) * bpm) / 60 + OVERRUN_BEATS
	const loopBeats = LOOP_BEATS.find((length) => length <= available) ?? Math.floor(available)
	if (loopBeats < 1) {
		return undefined
	}
	return { start, end: Math.min(duration, start + (60 * loopBeats) / bpm), loopBeats }
}

/** Read saved detection results defensively: workspaces are user-editable JSON. */
export function detectedLoop(value: unknown): DetectedLoop | undefined {
	const saved = value as Partial<DetectedLoop> | undefined
	if (!saved || !Number.isFinite(saved.bpm) || saved.bpm! <= 0) {
		return undefined
	}
	const hasKey =
		Number.isInteger(saved.key) &&
		saved.key! >= 0 &&
		saved.key! < 12 &&
		(saved.scale === "major" || saved.scale === "minor")
	return {
		bpm: saved.bpm!,
		...(Number.isFinite(saved.bpmConfidence) ? { bpmConfidence: saved.bpmConfidence } : {}),
		...(hasKey
			? {
					key: saved.key,
					scale: saved.scale,
					...(typeof saved.keyName === "string" ? { keyName: saved.keyName } : {}),
					...(Number.isFinite(saved.keyStrength)
						? { keyStrength: saved.keyStrength }
						: {})
				}
			: {})
	}
}

export function describeDetectedLoop(detected: DetectedLoop): string {
	const key = detected.scale ? `, ${detected.keyName ?? detected.key} ${detected.scale}` : ""
	return `Detected ${Math.round(detected.bpm * 10) / 10} BPM${key}`
}