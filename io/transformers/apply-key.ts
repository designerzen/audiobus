import { AEOLIAN_INTERVALS, IONIAN_INTERVALS } from "../../tuning/intervals"
import { mod12 } from "../../tuning/pitch-class-set"
import { TUNING_MODE_AEOLIAN, TUNING_MODE_IONIAN } from "../../tuning/scales"
import { ID_CHORDIFIER } from "./transformer-chordifier"

/** A key as audio analysis reports it: tonic pitch class (0 = C) and major or minor. */
export interface DetectedKey {
	key: number
	scale: "major" | "minor"
}

/** The part of a transformer this module touches; ITransformer does not expose configuration. */
interface Configurable {
	type?: string
	options?: Record<string, unknown>
	setConfig?(key: string, value: unknown): void
}

/** MIDI note 21 is A0 and the Chordifier counts its root from there, so its 0 is A rather than C. */
const CHORDIFIER_ROOT_OFFSET = 9
const isNumber = (value: unknown): value is number => typeof value === "number"

/**
 * The configuration changes that put a transformer in a key, or undefined when it has no key setting
 * we can map without guessing. Shapes are matched on the configuration, not the transformer class,
 * so new transformers that reuse a convention are covered without registering them here:
 *  - Harmoniser: `root` (0 = C) and `mode` as an interval array
 *  - Magenta Melody: `root` (0 = C) and `scale` as a name
 *  - Tonal progression family (Key Traveller, Cadence Weaver, …): `key` (0 = C) and `mode` "major"/"minor"
 *  - Chordifier: `root` counted from A, and `mode` as a mode name
 * Settings that mean "no key" are left alone: a chromatic scale, and a progression transformer that
 * follows the shared harmony instead of its local key.
 */
function keyChanges(
	transformer: Configurable,
	{ key, scale }: DetectedKey
): Array<[string, unknown]> | undefined {
	const { options } = transformer
	if (!options || typeof transformer.setConfig !== "function") {
		return undefined
	}
	const root = mod12(Math.round(key))
	const minor = scale === "minor"
	if (transformer.type === ID_CHORDIFIER) {
		return [
			["root", mod12(root - CHORDIFIER_ROOT_OFFSET)],
			["mode", minor ? TUNING_MODE_AEOLIAN : TUNING_MODE_IONIAN]
		]
	}
	if (isNumber(options.root) && Array.isArray(options.mode)) {
		return options.mode.length >= 12
			? undefined
			: [
					["root", root],
					["mode", [...(minor ? AEOLIAN_INTERVALS : IONIAN_INTERVALS)]]
				]
	}
	if (isNumber(options.root) && typeof options.scale === "string") {
		return options.scale === "chromatic"
			? [["root", root]]
			: [
					["root", root],
					["scale", scale]
				]
	}
	if (isNumber(options.key) && (options.mode === "major" || options.mode === "minor")) {
		return options.source === "shared"
			? undefined
			: [
					["key", root],
					["mode", scale]
				]
	}
	return undefined
}

/** How many of these transformers have a key that applyKeyToTransformers would set. */
export function countKeyTransformers(transformers: readonly object[]): number {
	return transformers.filter((transformer) =>
		keyChanges(transformer as Configurable, { key: 0, scale: "major" })
	).length
}

/**
 * Set the key of every transformer that has one (see keyChanges), through setConfig so each
 * validates and reacts as it does for a control edit. Returns the types of the transformers changed.
 * The caller should announce the edit to the chain so the workspace is saved.
 */
export function applyKeyToTransformers(
	transformers: readonly object[],
	detected: DetectedKey
): string[] {
	const applied: string[] = []
	for (const transformer of transformers as Configurable[]) {
		const changes = keyChanges(transformer, detected)
		if (!changes) {
			continue
		}
		for (const [name, value] of changes) {
			transformer.setConfig!(name, value)
		}
		applied.push(transformer.type ?? "Transformer")
	}
	return applied
}