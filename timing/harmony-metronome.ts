import type { MusicalTiming } from "../io/music-tools"

/** Quarter-note positions; fractional clicks are scheduled on the audio clock. */
export function harmonyMetronomeClicks(start: number, end: number, timing: MusicalTiming, fallbackBeats = 4): Array<{ at: number; accent: boolean; secondary: boolean }> {
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
	const signature = timing.timeSignature
	const beatLength = signature ? 32 / (signature.denominator * signature.thirtySecondNotes) : 1
	const barLength = signature ? signature.numerator * beatLength : fallbackBeats
	const metro = timing.metronome
	const primary = metro ? metro.clocksPerClick / 24 : beatLength
	const accents = metro?.barAccents.filter(n => n > 0) ?? []
	const accentPeriod = accents.reduce((sum, n) => sum + n, 0)
	const clicks = new Map<number, { at: number; accent: boolean; secondary: boolean }>()
	for (const division of new Set([1, ...(metro?.subdivisions ?? []).filter(n => n > 1)])) {
		const interval = primary / division
		const first = Math.ceil((start - 1e-8) / interval)
		const last = Math.ceil((end - 1e-8) / interval)
		for (let i = first; i < last && clicks.size < 1024; i++) {
			const at = i * interval || 0
			const primaryIndex = at / primary
			const isPrimary = Math.abs(primaryIndex - Math.round(primaryIndex)) < 1e-7
			let accent = false
			if (isPrimary && accentPeriod) {
				const position = ((Math.round(primaryIndex) % accentPeriod) + accentPeriod) % accentPeriod
				let boundary = 0
				for (const count of accents) { if (position === boundary) accent = true; boundary += count }
			} else if (isPrimary) {
				accent = Math.abs(at / barLength - Math.round(at / barLength)) < 1e-7
			}
			clicks.set(Math.round(at * 1e8), { at, accent, secondary: !isPrimary })
		}
	}
	return [...clicks.values()].sort((a, b) => a.at - b.at)
}
