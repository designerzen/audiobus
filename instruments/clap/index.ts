/**
 * CLAP Instrument Module
 * Web-based CLAP plugin synthesizer
 */

export { default as CLAPInstrument } from "./clap-instrument.ts"
export type { CLAPPatch } from "./clap-types.ts"
export { CLAPRegistry, clapRegistry, initializeCLAPRegistry } from "./clap-registry.ts"
