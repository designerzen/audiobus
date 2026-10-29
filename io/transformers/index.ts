/**
 * Audio Transformers
 * Effects and signal processors for the audio pipeline
 */

export type { ITransformer } from './interface-transformer.ts'
export { default as Transformer } from './abstract-transformer.ts'
export { TransformerVelocityShaper } from './transformer-velocity-shaper.ts'
export { TransformerStrummer } from './transformer-strummer.ts'
export { TransformerProbabilityGate } from './transformer-probability-gate.ts'
export { TransformerNoteMapper } from './transformer-note-mapper.ts'
export { TransformerLatch } from './transformer-latch.ts'
export { TransformerEuclideanGate } from './transformer-euclidean-gate.ts'
export { TransformerVoiceLeader } from './transformer-voice-leader.ts'
export { TransformerCCAnimator } from './transformer-cc-animator.ts'
export { TransformerOrnamenter } from './transformer-ornamenter.ts'
export { TransformerPhraseRecombiner } from './transformer-phrase-recombiner.ts'
export { TransformerLegato } from './transformer-legato.ts'
export { TransformerCCMapper } from './transformer-cc-mapper.ts'
