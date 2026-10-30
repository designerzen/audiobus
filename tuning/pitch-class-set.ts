/** Twelve-tone pitch sets use Ian Ring's convention: bit 0 is the tonic. */
export const FULL_PITCH_SET = 4095
export const mod12 = (value: number) => ((value % 12) + 12) % 12

export function pitchSetMask(value: unknown): number {
	const mask = Number(value)
	if (
		value === null ||
		String(value).trim() === "" ||
		!Number.isInteger(mask) ||
		mask < 0 ||
		mask > FULL_PITCH_SET
	) {
		throw new Error("Enter a whole-number pitch-set ID from 0 to 4095 (0 is silence).")
	}
	return mask
}

export function pitchClasses(mask: number): number[] {
	return Array.from({ length: 12 }, (_, pitch) => pitch).filter((pitch) => mask & (1 << pitch))
}

export function mapPitchSet(mask: number, multiplier = 1, offset = 0): number {
	return pitchClasses(mask).reduce(
		(result, pitch) => result | (1 << mod12(pitch * multiplier + offset)),
		0
	)
}

/** A numeric representative of a T/I orbit; deliberately not a Forte catalogue number. */
export function pitchSetClass(mask: number, reflect = true): number {
	let minimum = mask
	for (let offset = 0; offset < 12; offset++) {
		minimum = Math.min(minimum, mapPitchSet(mask, 1, offset))
		if (reflect) {
			minimum = Math.min(minimum, mapPitchSet(mask, -1, offset))
		}
	}
	return minimum
}

let classes: number[] | undefined
export function allPitchSetClasses(): number[] {
	return (classes ??= [
		...new Set(Array.from({ length: FULL_PITCH_SET }, (_, i) => pitchSetClass(i + 1)))
	].sort((a, b) => pitchClasses(a).length - pitchClasses(b).length || a - b))
}

export function pitchSetAnalysis(mask: number) {
	const pitches = pitchClasses(mask)
	const steps = pitches.map((pitch, i) => mod12(pitches[(i + 1) % pitches.length] - pitch) || 12)
	const autocorrelation = Array.from(
		{ length: 12 },
		(_, shift) => pitches.filter((pitch) => mask & (1 << mod12(pitch + shift))).length
	)
	const intervals = autocorrelation.slice(1, 7)
	intervals[5] /= 2
	return { pitches, steps, autocorrelation, intervals, classId: pitchSetClass(mask) }
}

export function quantisePitchSet(
	note: number,
	mask: number,
	root: number,
	direction = "nearest"
): number | undefined {
	const contains = (pitch: number) =>
		pitch >= 0 && pitch <= 127 && Boolean(mask & (1 << mod12(pitch - root)))
	if (direction === "filter") {
		return contains(note) ? note : undefined
	}
	// Search the entire MIDI range: sparse sets near an edge can be almost an octave away.
	for (let distance = 0; distance <= 127; distance++) {
		if (direction !== "up" && contains(note - distance)) {
			return note - distance
		}
		if (direction !== "down" && contains(note + distance)) {
			return note + distance
		}
	}
	return undefined
}