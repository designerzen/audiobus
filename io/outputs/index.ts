/**
 * Audio Outputs
 * Output destinations and processors
 */

export { OUTPUT_TYPES } from './output-types.ts'

export {
  IOutput,
  BaseOutput,
} from './output.ts'

export {
  WebAudioOutput,
} from './web-audio-output.ts'

export {
  WebMIDIOutput,
} from './webmidi-output.ts'

export {
  NotationOutput,
  NotationFormat,
} from './notation-output.ts'

export {
  SpectrumAnalyserOutput,
} from './spectrum-analyser-output.ts'

export {
  SpeechSynthesisOutput,
} from './speech-synthesis-output.ts'

export {
  VibratorOutput,
} from './vibrator-output.ts'

export {
  OutputWAM2,
} from './output-wam2.ts'
