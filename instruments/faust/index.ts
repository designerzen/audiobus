/**
 * FAUST Instrument Module
 * Exports all FAUST-related types and utilities
 */

export { default as FAUSTInstrument } from "./faust-instrument.ts"
export type { FAUSTDSPModule, FAUSTDSPInstance, FAUSTParameter } from "./faust-types.ts"
export { faustRegistry, initializeFAUSTRegistry } from "./faust-registry.ts"
