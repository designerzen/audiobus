/**
 * Effects & Audio Processing
 * Reverb, delay, filters, and other signal processors
 */

export {
  Effect,
  AudioEffect,
} from './effect.ts'

export {
  Reverb,
  ReverbParams,
} from './reverb.ts'

export {
  Delay,
  DelayParams,
} from './delay.ts'

export {
  Distortion,
  DistortionParams,
} from './distortion.ts'

export {
  Compressor,
  CompressorParams,
} from './compressor.ts'

export {
  EQ,
  EQBand,
} from './eq.ts'

export {
  EffectFactory,
  createEffect,
  getAvailableEffects,
} from './effect-factory.ts'

export {
  EffectChain,
} from './effect-chain.ts'
