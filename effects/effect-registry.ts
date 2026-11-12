import type { EffectDefinition, IEffect } from "./effect-interface"
import * as EFFECTS from "./effect-definitions"

type EffectModule = {
	default: new (context: BaseAudioContext, options?: Record<string, any>) => IEffect
}

export interface EffectEntry extends EffectDefinition {
	create(context: BaseAudioContext, options?: Record<string, any>): Promise<IEffect>
}

const lazy = (definition: EffectDefinition, load: () => Promise<EffectModule>): EffectEntry => ({
	...definition,
	create: async (context, options) => new (await load()).default(context, options)
})

/** Every effect, in the order offered to users; modules load only when an effect is created. */
export const EFFECT_REGISTRY: readonly EffectEntry[] = [
	lazy(EFFECTS.REVERB, () => import("./effect-reverb")),
	{
		...EFFECTS.IMPULSE_RESPONSE,
		create: async (context, options) =>
			(await import("./effect-impulse-response")).default.create({
				...options,
				audioContext: context
			})
	},
	lazy(EFFECTS.DELAY, () => import("./effect-delay")),
	lazy(EFFECTS.PING_PONG_DELAY, () => import("./effect-ping-pong-delay")),
	lazy(EFFECTS.CHORUS, () => import("./effect-chorus")),
	lazy(EFFECTS.FLANGER, () => import("./effect-flanger")),
	lazy(EFFECTS.PHASER, () => import("./effect-phaser")),
	lazy(EFFECTS.VIBRATO, () => import("./effect-vibrato")),
	lazy(EFFECTS.TREMOLO, () => import("./effect-tremolo")),
	lazy(EFFECTS.AUTO_PAN, () => import("./effect-auto-pan")),
	lazy(EFFECTS.FILTER, () => import("./effect-filter")),
	lazy(EFFECTS.AUTO_FILTER, () => import("./effect-auto-filter")),
	lazy(EFFECTS.EQ, () => import("./effect-eq")),
	lazy(EFFECTS.COMPRESSOR, () => import("./effect-compressor")),
	lazy(EFFECTS.LIMITER, () => import("./effect-limiter")),
	lazy(EFFECTS.DISTORTION, () => import("./effect-distortion")),
	lazy(EFFECTS.BITCRUSHER, () => import("./effect-bitcrusher")),
	lazy(EFFECTS.RING_MODULATOR, () => import("./effect-ring-modulator")),
	lazy(EFFECTS.STEREO_WIDTH, () => import("./effect-stereo-width")),
	lazy(EFFECTS.UTILITY, () => import("./effect-utility"))
]