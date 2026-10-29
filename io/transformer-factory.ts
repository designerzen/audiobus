import { IdentityTransformer } from "./transformers/transformer-identity.ts"
import { TransformerQuantise, ID_QUANTISE } from "./transformers/transformer-quantise.ts"
import { TransformerHarmoniser, ID_HARMONISER } from "./transformers/transformer-harmoniser.ts"
import { TransformerArpeggiator, ID_ARPEGGIATOR } from "./transformers/transformer-arpeggiator.ts"
import { TransformerNoteShortener, ID_NOTE_SHORTENER } from "./transformers/transformer-note-shortener.ts"
import { TransformerNoteRepeater, ID_NOTE_REPEATER } from "./transformers/transformer-note-repeater.ts"
import { TransformerNoteReverb, ID_NOTE_REVERB } from "./transformers/transformer-note-reverb.ts"
import { TransformerRandomiser, ID_RANDOMISER } from "./transformers/transformer-randomiser.ts"
import { TransformerNoteDelay, ID_NOTE_DELAY } from "./transformers/transformer-note-delay.ts"
import { TransformerChordifier, ID_CHORDIFIER } from "./transformers/transformer-chordifier.ts"
import { ID_TRANSPOSER, TransformerTransposer } from "./transformers/transformer-transposer.ts"
import { ID_MICROTONALITY, TransformerMicroTonality } from "./transformers/transformer-microtonality.ts"
import { ID_CHANNELER, TransformerChanneler } from "./transformers/transformer-channeler.ts"
import { ID_CONSTRICTOR, TransformerConstrictor } from "./transformers/transformer-constrictor.ts"
import { ID_TIMING_HUMANISER, TransformerTimingHumaniser } from "./transformers/transformer-timing-humaniser.ts"
import { ID_VIBRATOR, TransformerVibrator } from "./transformers/transformer-vibrator.ts"
import { ID_FILTER, TransformerFilter } from "./transformers/transformer-filter.ts"
import { ID_EMOJI, TransformerEmoji } from "./transformers/transformer-emoji.ts"
import { ID_MIDI_FILE_PLAYER, TransformerMIDIFilePlayer } from "./transformers/transformer-midi-file-player.ts"
import { ID_MAGENTA, TransformerMagenta } from "./transformers/transformer-magenta.ts"
import { ID_BROWSER_AI, TransformerBrowserAI } from './transformers/transformer-browser-ai'
import { ID_VELOCITY_SHAPER, TransformerVelocityShaper } from './transformers/transformer-velocity-shaper.ts'
import { ID_STRUMMER, TransformerStrummer } from './transformers/transformer-strummer.ts'
import { ID_PROBABILITY_GATE, TransformerProbabilityGate } from './transformers/transformer-probability-gate.ts'
import { ID_NOTE_MAPPER, TransformerNoteMapper } from './transformers/transformer-note-mapper.ts'
import { ID_LATCH, TransformerLatch } from './transformers/transformer-latch.ts'
import { ID_EUCLIDEAN_GATE, TransformerEuclideanGate } from './transformers/transformer-euclidean-gate.ts'
import { ID_VOICE_LEADER, TransformerVoiceLeader } from './transformers/transformer-voice-leader.ts'
import { ID_CC_ANIMATOR, TransformerCCAnimator } from './transformers/transformer-cc-animator.ts'
import { ID_ORNAMENTER, TransformerOrnamenter } from './transformers/transformer-ornamenter.ts'
import { ID_PHRASE_RECOMBINER, TransformerPhraseRecombiner } from './transformers/transformer-phrase-recombiner.ts'
import { ID_LEGATO, TransformerLegato } from './transformers/transformer-legato.ts'
import { ID_CC_MAPPER, TransformerCCMapper } from './transformers/transformer-cc-mapper.ts'
import { ID_PITCH_MIRROR, TransformerPitchMirror } from './transformers/transformer-pitch-mirror.ts'
import { ID_INTERVAL_STACK, TransformerIntervalStack } from './transformers/transformer-interval-stack.ts'
import { ID_NOTE_BOUNCER, TransformerNoteBouncer } from './transformers/transformer-note-bouncer.ts'
import { ID_RELEASE_TRIGGER, TransformerReleaseTrigger } from './transformers/transformer-release-trigger.ts'
import { ID_POLYPHONY_LIMITER, TransformerPolyphonyLimiter } from './transformers/transformer-polyphony-limiter.ts'
import { ID_NOTE_ROUTER, TransformerNoteRouter } from './transformers/transformer-note-router.ts'
import { ID_CHANNEL_ALLOCATOR, TransformerChannelAllocator } from './transformers/transformer-channel-allocator.ts'
import { ID_CC_STEPPER, TransformerCCStepper } from './transformers/transformer-cc-stepper.ts'

export const tranformerFactory = (type: string, config: any={} ) => {
    switch (type) {
        case ID_BROWSER_AI: return new TransformerBrowserAI(config)
        case ID_VELOCITY_SHAPER: return new TransformerVelocityShaper(config)
        case ID_STRUMMER: return new TransformerStrummer(config)
        case ID_PROBABILITY_GATE: return new TransformerProbabilityGate(config)
        case ID_NOTE_MAPPER: return new TransformerNoteMapper(config)
        case ID_LATCH: return new TransformerLatch(config)
        case ID_EUCLIDEAN_GATE: return new TransformerEuclideanGate(config)
        case ID_VOICE_LEADER: return new TransformerVoiceLeader(config)
        case ID_CC_ANIMATOR: return new TransformerCCAnimator(config)
        case ID_ORNAMENTER: return new TransformerOrnamenter(config)
        case ID_PHRASE_RECOMBINER: return new TransformerPhraseRecombiner(config)
        case ID_LEGATO: return new TransformerLegato(config)
        case ID_CC_MAPPER: return new TransformerCCMapper(config)
        case ID_PITCH_MIRROR: return new TransformerPitchMirror(config)
        case ID_INTERVAL_STACK: return new TransformerIntervalStack(config)
        case ID_NOTE_BOUNCER: return new TransformerNoteBouncer(config)
        case ID_RELEASE_TRIGGER: return new TransformerReleaseTrigger(config)
        case ID_POLYPHONY_LIMITER: return new TransformerPolyphonyLimiter(config)
        case ID_NOTE_ROUTER: return new TransformerNoteRouter(config)
        case ID_CHANNEL_ALLOCATOR: return new TransformerChannelAllocator(config)
        case ID_CC_STEPPER: return new TransformerCCStepper(config)
        case ID_MAGENTA: return new TransformerMagenta(config)
        case ID_ARPEGGIATOR: return new TransformerArpeggiator(config)
    case ID_CHANNELER: return new TransformerChanneler(config)
        case ID_CHORDIFIER: return new TransformerChordifier(config)
        case ID_CONSTRICTOR: return new TransformerConstrictor(config)
    case ID_EMOJI: return new TransformerEmoji(config)
    case ID_FILTER: return new TransformerFilter(config)
        case ID_HARMONISER: return new TransformerHarmoniser(config)
        case ID_MICROTONALITY: return new TransformerMicroTonality(config)
        case ID_MIDI_FILE_PLAYER: return new TransformerMIDIFilePlayer(config)
        case ID_NOTE_DELAY: return new TransformerNoteDelay(config)
    case ID_NOTE_REPEATER: return new TransformerNoteRepeater(config)
    case ID_NOTE_REVERB: return new TransformerNoteReverb(config)
    case ID_NOTE_SHORTENER: return new TransformerNoteShortener(config)
         case ID_QUANTISE: return new TransformerQuantise(config)
    case ID_RANDOMISER: return new TransformerRandomiser(config)
    case ID_TIMING_HUMANISER: return new TransformerTimingHumaniser(config)
    case ID_TRANSPOSER: return new TransformerTransposer(config)
    case ID_VIBRATOR: return new TransformerVibrator(config)
    default: return new IdentityTransformer(config)
    }
}

export const TRANSFORMER_TYPE = {
    ID_BROWSER_AI,
    ID_VELOCITY_SHAPER,
    ID_STRUMMER,
    ID_PROBABILITY_GATE,
    ID_NOTE_MAPPER,
    ID_LATCH,
    ID_EUCLIDEAN_GATE,
    ID_VOICE_LEADER,
    ID_CC_ANIMATOR,
    ID_ORNAMENTER,
    ID_PHRASE_RECOMBINER,
    ID_LEGATO,
    ID_CC_MAPPER,
    ID_PITCH_MIRROR,
    ID_INTERVAL_STACK,
    ID_NOTE_BOUNCER,
    ID_RELEASE_TRIGGER,
    ID_POLYPHONY_LIMITER,
    ID_NOTE_ROUTER,
    ID_CHANNEL_ALLOCATOR,
    ID_CC_STEPPER,
    ID_MAGENTA,
    ID_ARPEGGIATOR,
    ID_CHANNELER,
    ID_CHORDIFIER,
	ID_CONSTRICTOR,
	ID_EMOJI,
	ID_FILTER,
    ID_HARMONISER,
    ID_MICROTONALITY,
    ID_MIDI_FILE_PLAYER,
    ID_NOTE_SHORTENER,
    ID_NOTE_REPEATER,
    ID_NOTE_REVERB,
    ID_NOTE_DELAY,
	ID_QUANTISE,
    ID_RANDOMISER,
    ID_TIMING_HUMANISER,
    ID_VIBRATOR,
    ID_TRANSPOSER
}

export const TRANSFORMERS = Object.values(TRANSFORMER_TYPE)
