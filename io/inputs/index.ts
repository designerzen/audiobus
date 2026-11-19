/**
 * Audio Inputs
 * Input devices and sources
 */

export type { IAudioInput } from "./input-interface.ts"
export { default as AbstractInput } from "./abstract-input.ts"
export { default as InputProtocol } from "./input-protocol.ts"
export type { InputAudioEvent } from "../events/index.ts"