/**
 * Audio Outputs
 * Output destinations and processors
 */

export type { IAudioOutput } from "./output-interface.ts"
export { default as OutputProtocol } from "./output-protocol.ts"
export { default as Output303 } from "./output-303.ts"
export { default as OutputDrumKit } from "./output-drum-kit.ts"
export type { OutputAudioEvent } from "../events/index.ts"

export { default as OutputSiON } from "./output-sion.ts"
export { default as ChromaticSampler } from "./output-chromatic-sampler.ts"
export { default as OutputLoopPlayer } from "./output-loop-player.ts"
export { default as Rompler } from "./rompler/output-rompler.ts"
export { default as OutputFM } from "./output-fm.ts"
export { default as OutputMonotron } from "./output-monotron.ts"
export { default as OutputWaveguide } from "./output-waveguide.ts"
export { default as OutputMultiOscillator } from "./output-multi-oscillator.ts"
