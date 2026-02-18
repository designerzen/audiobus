import { IdentityTransformer } from "./transformers/transformer-identity.ts"
import { TransformerQuantise, ID_QUANTISE } from "./transformers/transformer-quantise.ts"
import { TransformerHarmoniser, ID_HARMONISER } from "./transformers/transformer-harmoniser.ts"
import { TransformerArpeggiator, ID_ARPEGGIATOR } from "./transformers/transformer-arpeggiator.ts"
import { TransformerNoteShortener, ID_NOTE_SHORTENER } from "./transformers/transformer-note-shortener.ts"
import { TransformerNoteRepeater, ID_NOTE_REPEATER } from "./transformers/transformer-note-repeater.ts"
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

export const tranformerFactory = (type: string, config: any={} ) => {
    switch (type) {
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
    ID_NOTE_DELAY,
	ID_QUANTISE,
    ID_RANDOMISER,
    ID_TRANSPOSER
}

// Add the transformers that require certain functionality
TRANSFORMER_TYPE[ID_VIBRATOR] = ID_VIBRATOR

export const TRANSFORMERS = Object.values(TRANSFORMER_TYPE)
