// PPQN Constants
export const QUARTER:number = 960
export const BAR: number = QUARTER << 2 // 3_840
export const SEMI_QUAVER: number = QUARTER >>> 2 // 240

// Hex
export const SEMITONE = 0x00800000

export const Ticks = {
    /** How many ticks pass in "1 whole note" or 4x1/4th notes in a 4/4th beat, independent of tempo. */
    SemiBreve: 15360,
    /** How many ticks pass in 1 quarter note in a 4/4th bar, independent of tempo. */
    Beat: 3840,
    /** How many ticks pass in 1/16th note in a 4/4th bar, independent of tempo. */
    SemiQuaver: 960
} as const
