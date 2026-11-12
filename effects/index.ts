/**
 * Effects & Audio Processing
 * Reverb, delay, filters, and other signal processors
 */

export { BT_PEQ, BT_BPF, cookBiquadVoxengo, createVoxengoBiquadFilter } from "./biquad-voxengo.ts"
export type {
	BiquadCoefficients,
	VoxengoBiquadType,
	VoxengoBiquadOptions
} from "./biquad-voxengo.ts"

export type {
	IEffect,
	EffectDefinition,
	EffectParameter,
	EffectChoice,
	EffectValue
} from "./effect-interface.ts"
export { default as AbstractEffect } from "./abstract-effect.ts"
export * from "./effect-definitions.ts"
export { EFFECT_REGISTRY } from "./effect-registry.ts"
export type { EffectEntry } from "./effect-registry.ts"
export { createReverbImpulseResponse } from "./reverb.ts"