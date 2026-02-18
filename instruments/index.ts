/**
 * Instruments & Synthesis
 * Virtual instruments, oscillators, and sound generation
 */

export {
  Synth,
  PolyphonicSynth,
} from './synth.ts'

export {
  Oscillator,
  OscillatorType,
} from './oscillator.ts'

export {
  Envelope,
  ADSREnvelope,
} from './envelope.ts'

export {
  Filter,
  BiquadFilter,
} from './filter.ts'

export {
  InstrumentFactory,
  createInstrument,
  getAvailableInstruments,
} from './instrument-factory.ts'

export {
  VirtualInstrument,
  InstrumentConfig,
} from './virtual-instrument.ts'
