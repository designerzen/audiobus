/**
 * Instruments & Synthesis
 * Virtual instruments, oscillators, and sound generation
 */
export {
  SynthOscillator,
} from './oscillators/synth-oscillator.ts'

export {
  ToneSynth,
  ToneMonoSynth,
  TonePluckString,
  ToneSampler,
  ToneFMSynth,
} from './tone/index.ts'

export {
  // Constants
  INSTRUMENT_TYPE_SYNTH_OSCILLATOR,
  INSTRUMENT_TYPE_TONE_SYNTH,
  INSTRUMENT_TYPE_TONE_MONO_SYNTH,
  INSTRUMENT_TYPE_TONE_FM_SYNTH,
  INSTRUMENT_TYPE_TONE_PLUCK_STRING,
  INSTRUMENT_TYPE_TONE_SAMPLER,
  INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
  INSTRUMENT_CATEGORY_OSCILLATOR,
  INSTRUMENT_CATEGORY_SYNTHESIS,
  INSTRUMENT_CATEGORY_FM,
  INSTRUMENT_CATEGORY_PHYSICAL,
  INSTRUMENT_CATEGORY_SAMPLING,
  INSTRUMENT_CATEGORY_SUPERCOLLIDER,
  EXTERNAL_DATA_KEY_SCSYNTH,
  EXTERNAL_DATA_KEY_SAMPLE_URLS,
  INSTRUMENTS,
  // Types
  type InstrumentMetadata,
} from './instrument-types.ts'

export {
  InstrumentFactory,
  createInstrument,
  getAvailableInstruments,
  getInstrumentMetadata,
} from './instrument-factory.ts'

export {
  getAvailableInstrumentFactories,
  getInstrumentFactoriesByCategory,
  createInstrumentById,
  getInstrumentCategories,
  type InstrumentUIFactory,
} from './instrument-factory-ui.ts'
