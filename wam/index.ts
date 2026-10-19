/**
 * Web Audio Modules (WAM)
 * WAM2 plugin support and host functionality
 */

export { default as OutputWAM2 } from '../io/outputs/output-wam2'
export { default as OutputMoog } from '../io/outputs/output-moog'
export { default as OutputWAM } from '../io/outputs/output-wam'
export { WAM2Registry, WAM2_INSTRUMENTS, wam2OutputId } from './registry'
export type { WAM2PluginDescriptor } from './registry'
export { initializeHost, WAM_MIDI_EVENT, WAM_AUTOMATION_EVENT } from './host'
