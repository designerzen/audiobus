/**
 * Audio Outputs
 * Output destinations and processors
 */

export type { IAudioOutput } from './output-interface.ts'
export { default as OutputAudioBus303 } from './output-audiobus-303.ts'
export { default as OutputDrumKit } from './output-drum-kit.ts'
export type { OutputAudioEvent } from '../events/index.ts'

export { default as OutputSiON } from './output-sion.ts'
