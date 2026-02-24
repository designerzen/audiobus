/**
 * Transforms incoming notes into a chord that matches the emotion of a given emoji
 * Happy emojis → major/bright chords
 * Sad emojis → minor/dark chords
 * Excited emojis → augmented/extended chords
 * Calm emojis → sus2/sus4 chords
 */
import { Transformer, type TransformerConfig } from "./abstract-transformer.ts"
import { cloneAudioCommand } from "../../audio-command-factory.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import {
    MAJOR_CHORD_INTERVALS,
    MINOR_CHORD_INTERVALS,
    DIMINISHED_CHORD_INTERVALS,
    AUGMENTED_CHORD_INTERVALS,
    SUSPENDED_2_CHORD_INTERVALS,
    SUSPENDED_4_CHORD_INTERVALS,
    MAJOR_SEVENTH_CHORD_INTERVALS,
    MINOR_SEVENTH_CHORD_INTERVALS,
    HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS,
    DIMINISHED_SEVENTH_CHORD_INTERVALS,
    MAJOR_NINTH_CHORD_INTERVALS,
    POWER_CHORD_EXTENDED_INTERVALS,
    MINOR_PENTATONIC_INTERVALS,
    MAJOR_PENTATONIC_INTERVALS,
    BLUES_SCALE_INTERVALS,
    MINOR_SECOND,
    PERFECT_FIFTH
} from "../../tuning/intervals.js"

import type { ITimerControl as Timer } from "netronome"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { FieldConfig, ITransformer } from "./interface-transformer.ts"

export const ID_EMOJI = "Moodifier"

interface Config extends TransformerConfig {
    emoji: string
}

const DEFAULT_OPTIONS: Config = {
    emoji: "😊",
    enabled: true,
    available: false
}

// Locrian-inspired interval set for very dark/angry emotions
const LOCRIAN_DARK = [0, MINOR_SECOND, 3, PERFECT_FIFTH, 6, 8, 10]

// Emoji emotion mapping with chord intervals from intervals.js
const EMOJI_EMOTIONS = {
    // Happy/positive
    "😊": { name: "Happy", intervals: MAJOR_CHORD_INTERVALS, velocity: 0.9 },
    "😄": { name: "Very Happy", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 1 },
    "😃": { name: "Happy", intervals: MAJOR_CHORD_INTERVALS, velocity: 0.9 },
    "😁": { name: "Joyful", intervals: POWER_CHORD_EXTENDED_INTERVALS, velocity: 1 },
    "😆": { name: "Laughing", intervals: MAJOR_CHORD_INTERVALS, velocity: 0.85 },
    "🥰": { name: "Loving", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.8 },
    "😍": { name: "Love", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.8 },
    "🤩": { name: "Amazed", intervals: AUGMENTED_CHORD_INTERVALS, velocity: 0.95 },
    "😌": { name: "Content", intervals: SUSPENDED_4_CHORD_INTERVALS, velocity: 0.7 },
    "😴": { name: "Sleepy", intervals: MINOR_CHORD_INTERVALS, velocity: 0.5 },

    // Sad/negative
    "😢": { name: "Sad", intervals: MINOR_CHORD_INTERVALS, velocity: 0.6 },
    "😭": { name: "Very Sad", intervals: DIMINISHED_CHORD_INTERVALS, velocity: 0.5 },
    "😞": { name: "Disappointed", intervals: MINOR_CHORD_INTERVALS, velocity: 0.6 },
    "😔": { name: "Pensive", intervals: MINOR_CHORD_INTERVALS, velocity: 0.65 },
    "😕": { name: "Confused", intervals: MINOR_SEVENTH_CHORD_INTERVALS, velocity: 0.7 },
    "😟": { name: "Worried", intervals: DIMINISHED_CHORD_INTERVALS, velocity: 0.65 },
    "😬": { name: "Anxious", intervals: HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS, velocity: 0.7 },

    // Excited/energetic
    "🎉": { name: "Celebrating", intervals: POWER_CHORD_EXTENDED_INTERVALS, velocity: 1 },
    "⚡": { name: "Energetic", intervals: MAJOR_CHORD_INTERVALS, velocity: 1 },
    "🔥": { name: "Hot/Intense", intervals: AUGMENTED_CHORD_INTERVALS, velocity: 0.95 },
    "💫": { name: "Magical", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.9 },

    // Calm/peaceful
    "🧘": { name: "Meditative", intervals: SUSPENDED_4_CHORD_INTERVALS, velocity: 0.5 },
    "☮️": { name: "Peaceful", intervals: SUSPENDED_4_CHORD_INTERVALS, velocity: 0.55 },
    "🌙": { name: "Dreamy", intervals: MINOR_SEVENTH_CHORD_INTERVALS, velocity: 0.5 },
    "💤": { name: "Sleepy", intervals: MINOR_CHORD_INTERVALS, velocity: 0.4 },

    // Angry/intense
    "😠": { name: "Angry", intervals: DIMINISHED_CHORD_INTERVALS, velocity: 0.85 },
    "😡": { name: "Furious", intervals: DIMINISHED_SEVENTH_CHORD_INTERVALS, velocity: 0.95 },
    "🤬": { name: "Very Angry", intervals: LOCRIAN_DARK, velocity: 1 },

    // Romantic/tender
    "💕": { name: "Love", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.75 },
    "💖": { name: "Heart", intervals: MAJOR_CHORD_INTERVALS, velocity: 0.7 },

    // Energetic/party
    "🎊": { name: "Festive", intervals: MAJOR_NINTH_CHORD_INTERVALS, velocity: 0.95 },
    "🎵": { name: "Musical", intervals: MAJOR_PENTATONIC_INTERVALS, velocity: 0.8 },
    "🎶": { name: "Melodic", intervals: MAJOR_PENTATONIC_INTERVALS, velocity: 0.8 },

    // Blues/moody
    "🎸": { name: "Blues", intervals: BLUES_SCALE_INTERVALS, velocity: 0.75 },
    "🎤": { name: "Soulful", intervals: MINOR_PENTATONIC_INTERVALS, velocity: 0.7 },

    // Additional emotions
    "😲": { name: "Surprised", intervals: AUGMENTED_CHORD_INTERVALS, velocity: 0.9 },
    "😮": { name: "Wow", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.85 },
    "🤔": { name: "Thinking", intervals: SUSPENDED_2_CHORD_INTERVALS, velocity: 0.65 },
    "😚": { name: "Kiss", intervals: MAJOR_CHORD_INTERVALS, velocity: 0.75 },
    "🥳": { name: "Party", intervals: MAJOR_NINTH_CHORD_INTERVALS, velocity: 0.95 },
    "😈": { name: "Evil", intervals: DIMINISHED_SEVENTH_CHORD_INTERVALS, velocity: 0.9 },
    "👿": { name: "Angry Demon", intervals: LOCRIAN_DARK, velocity: 0.95 },
    "😇": { name: "Angel", intervals: MAJOR_SEVENTH_CHORD_INTERVALS, velocity: 0.7 },
    "🥺": { name: "Pleading", intervals: MINOR_CHORD_INTERVALS, velocity: 0.55 },
    "😤": { name: "Frustrated", intervals: DIMINISHED_CHORD_INTERVALS, velocity: 0.8 },
    "😳": { name: "Embarrassed", intervals: SUSPENDED_4_CHORD_INTERVALS, velocity: 0.65 }
}

const EMOJIS = Object.keys(EMOJI_EMOTIONS)

export class TransformerEmoji extends Transformer<Config> implements ITransformer {

    protected type = ID_EMOJI
    category = TRANSFORMER_CATEGORY_TUNING

    get name(): string {
        return "Emoji"
    }

    get description(): string {
        return "Transform notes into chords matching an emoji's emotion"
    }

    get fields(): FieldConfig[] {
        return [
            {
                name: "enabled",
                type: "select",
                enabled: true,
                values: [
                    { name: "On", value: 1 },
                    { name: "Off", value: 0 }
                ],
                default: 1
            },
            {
                name: "emoji",
                type: "select",
                enabled: true,
                values: EMOJIS.map(emoji => {
					const data = EMOJI_EMOTIONS[emoji]
					return {
						name: emoji + " " + data.name,
						value: emoji
					}
                }),
                default: DEFAULT_OPTIONS.emoji
            }
        ]
    }

    constructor(config = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
    }

    /**
     * Get emotion data for an emoji
     * Falls back to happy if emoji not found
     */
    private getEmotionData(emoji: string) {
        return EMOJI_EMOTIONS[emoji as keyof typeof EMOJI_EMOTIONS] || EMOJI_EMOTIONS["😊"]
    }

    /**
     * Transform a single note into an emotional chord
     */
    private emotionalizeNote(command: IAudioCommand): IAudioCommand[] {
        const emotion = this.getEmotionData(this.config.emoji)
        const baseNote = command.number

        // Create chord notes based on emotion intervals
        const chordNotes: IAudioCommand[] = emotion.intervals.map((interval: number) => {
            const newCommand: IAudioCommand = cloneAudioCommand(command)
            newCommand.number = baseNote + interval
            // Scale velocity based on emotion intensity
            newCommand.velocity = (command.velocity ?? 1) * emotion.velocity
            return newCommand
        })

        return chordNotes
    }

    /**
     * Transform incoming commands using emoji emotion
     */
    transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
        if (!this.config.enabled || commands.length === 0) {
            return commands
        }

        return commands.flatMap(c => this.emotionalizeNote(c))
    }
}

