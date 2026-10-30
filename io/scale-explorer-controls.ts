import {
	allPitchSetClasses,
	FULL_PITCH_SET,
	mapPitchSet,
	pitchClasses,
	pitchSetMask
} from "../tuning/pitch-class-set"
import type { Control, Settings } from "./transformers/performance-transformer"

export const SCALE_EXPLORER_DEFAULTS: Settings = {
	source: "custom",
	mask: 2741,
	root: 0,
	mode: 0,
	operation: "original"
}

export function scaleExplorerControls(): Control[] {
	const named: Array<[string, number]> = [
		["Major / Ionian", 2741],
		["Natural minor", 1453],
		["Harmonic minor", 2477],
		["Melodic minor (ascending)", 2733],
		["Major pentatonic", 661],
		["Minor pentatonic", 1193],
		["Whole tone / Messiaen 1", 1365],
		["Octatonic half-whole / Messiaen 2", 1755],
		["Double harmonic major", 2483],
		["Chromatic", 4095]
	]
	return [
		{
			name: "source",
			label: "Scale collection",
			values: [
				{ name: "Custom pitch-set ID", value: "custom" },
				...named.map(([name, mask]) => ({ name, value: String(mask) })),
				...allPitchSetClasses().map((mask) => ({
					name: `${pitchClasses(mask).length} notes · class ${mask} · {${pitchClasses(mask).join(",")}}`,
					value: String(mask)
				}))
			],
			help: "Named starting points and all 223 nonempty classes under transposition and reflection. Explore each class using mode and operation."
		},
		{
			name: "mask",
			label: "Custom pitch-set ID (0–4095)",
			help: "Used with Custom. Bit 0 = tonic, bit 11 = 11 semitones above it. 0 = silence; 2741 = major. Even IDs and large gaps are allowed."
		},
		{
			name: "root",
			label: "Tonic",
			values: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"].map(
				(name, value) => ({ name, value })
			),
			min: 0,
			max: 11
		},
		{
			name: "operation",
			label: "Set operation",
			values: ["original", "invert", "complement", "fourths", "fifths"],
			help: "Invert: −p; complement: absent pitches; fourths: 5p; fifths: 7p, all modulo 12."
		},
		{
			name: "mode",
			label: "Mode rotation (0 = original)",
			values: Array.from({ length: 12 }, (_, i) => i),
			min: 0,
			max: 11,
			help: "1 puts the second selected pitch at the tonic; rotations wrap by note count. Applied after the set operation."
		}
	]
}

export function effectiveScaleSet(options: Settings): number {
	let mask = pitchSetMask(options.source === "custom" ? options.mask : options.source)
	switch (options.operation) {
		case "invert":
			mask = mapPitchSet(mask, -1)
			break
		case "complement":
			mask ^= FULL_PITCH_SET
			break
		case "fourths":
			mask = mapPitchSet(mask, 5)
			break
		case "fifths":
			mask = mapPitchSet(mask, 7)
			break
	}
	const pitches = pitchClasses(mask)
	if (pitches.length && Number(options.mode)) {
		mask = mapPitchSet(mask, 1, -pitches[Number(options.mode) % pitches.length])
	}
	return mask
}