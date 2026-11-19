import { bounded } from "../device-controls"

export type LoopStretchMode = "granular" | "slice" | "varispeed"

export interface LoopPlayerSettings {
	start: number
	end: number
	loopBeats: number
	mode: LoopStretchMode
}

export const MIN_LOOP_SECONDS = 0.01

export function loopPlayerSettings(
	options: Partial<LoopPlayerSettings>,
	duration: number
): LoopPlayerSettings {
	const minimum = Math.min(MIN_LOOP_SECONDS, duration)
	const start = bounded(options.start, 0, 0, duration - minimum)
	return {
		start,
		end: bounded(options.end, duration, start + minimum, duration),
		loopBeats: Math.round(bounded(options.loopBeats, 4, 1, 32)),
		mode: options.mode === "slice" || options.mode === "varispeed" ? options.mode : "granular"
	}
}

export function loopSourceBpm(settings: LoopPlayerSettings): number {
	return (60 * settings.loopBeats) / (settings.end - settings.start)
}