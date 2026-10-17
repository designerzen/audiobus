import * as INTERVALS from '../intervals.ts'
import { noteNumberToKeyName } from '../../conversion/note-to-key-name.ts'
import { noteNumberToName } from '../../conversion/note-to-name.ts'
import { memoizeLRU } from '../../utils/memoize.ts'

/**
 * Pass in an array of NoteNumbers and this will
 * try and show which scales, keys and musical modes
 * are being used in as much detail as possible
 */

/**
 * Convert an array of numbers into a array of
 * intervals, where each entry represents the 
 * difference between subsequent entries
 */
export const convertToIntervalArray = (notes: Array<number>) => {
    return notes.map((currentNote, index) => {
        const previousNote = index > 0 ? notes[index - 1] : currentNote
        return currentNote - previousNote
    })
}

/**
 * Determine Musical Mode (Ionian, Dorian...)
 */
export const describeMusicalMode = (intervals: Array<Number>) => {
    // which we then use to determine how many numbers are
    // between each entry
    const output = INTERVALS.MODAL_SCALES.filter(scale =>
        intervals.every(interval => scale.includes(Number(interval))))
    return output
}

const CHORD_PATTERNS: Array<[string, number[]]> = [
    ['major', INTERVALS.MAJOR_CHORD_INTERVALS],
    ['minor', INTERVALS.MINOR_CHORD_INTERVALS],
    ['diminished', INTERVALS.DIMINISHED_CHORD_INTERVALS],
    ['augmented', INTERVALS.AUGMENTED_CHORD_INTERVALS],
    ['suspended second', INTERVALS.SUSPENDED_2_CHORD_INTERVALS],
    ['suspended fourth', INTERVALS.SUSPENDED_4_CHORD_INTERVALS],
    ['major seventh', INTERVALS.MAJOR_SEVENTH_CHORD_INTERVALS],
    ['minor seventh', INTERVALS.MINOR_SEVENTH_CHORD_INTERVALS],
    ['dominant seventh', INTERVALS.DOMINANT_SEVENTH_CHORD_INTERVALS],
    ['minor major seventh', INTERVALS.MINOR_MAJOR_SEVENTH_CHORD_INTERVALS],
    ['half-diminished seventh', INTERVALS.HALF_DIMINISHED_SEVENTH_CHORD_INTERVALS],
    ['diminished seventh', INTERVALS.DIMINISHED_SEVENTH_CHORD_INTERVALS],
    ['augmented major seventh', INTERVALS.AUGMENTED_MAJOR_SEVENTH_CHORD_INTERVALS],
    ['augmented seventh', INTERVALS.AUGMENTED_SEVENTH_CHORD_INTERVALS],
    ['major ninth', INTERVALS.MAJOR_NINTH_CHORD_INTERVALS],
    ['minor ninth', INTERVALS.MINOR_NINTH_CHORD_INTERVALS],
    ['dominant ninth', INTERVALS.DOMINANT_NINTH_CHORD_INTERVALS],
    ['dominant seventh with added sharp eleventh', [...INTERVALS.DOMINANT_SEVENTH_CHORD_INTERVALS, INTERVALS.AUGMENTED_FOURTH]],
    ['major eleventh', [...INTERVALS.MAJOR_NINTH_CHORD_INTERVALS, 17]],
    ['minor eleventh', [...INTERVALS.MINOR_NINTH_CHORD_INTERVALS, 17]],
    ['dominant eleventh', [...INTERVALS.DOMINANT_NINTH_CHORD_INTERVALS, 17]],
    ['major thirteenth', [...INTERVALS.MAJOR_NINTH_CHORD_INTERVALS, 17, 21]],
    ['minor thirteenth', [...INTERVALS.MINOR_NINTH_CHORD_INTERVALS, 17, 21]],
    ['dominant thirteenth', [...INTERVALS.DOMINANT_NINTH_CHORD_INTERVALS, 17, 21]],
    ['major add nine', INTERVALS.ADD9_CHORD_INTERVALS],
    ['minor add nine', INTERVALS.MINOR_ADD9_CHORD_INTERVALS],
    ['major add eleven', INTERVALS.ADD11_CHORD_INTERVALS],
    ['major sixth', INTERVALS.ADD6_CHORD_INTERVALS],
    ['minor sixth', INTERVALS.MINOR_ADD6_CHORD_INTERVALS],
    ['dominant seventh flat five', INTERVALS.DOMINANT_FLAT5_CHORD_INTERVALS],
    ['dominant seventh flat nine', INTERVALS.DOMINANT_FLAT9_CHORD_INTERVALS],
    ['dominant seventh sharp nine', INTERVALS.DOMINANT_SHARP9_CHORD_INTERVALS],
    ['dominant seventh flat five flat nine', INTERVALS.DOMINANT_FLAT9_FLAT5_CHORD_INTERVALS],
    ['quartal', INTERVALS.QUARTAL_CHORD_INTERVALS],
    ['quintal', INTERVALS.QUINTAL_CHORD_INTERVALS],
    ['power', INTERVALS.POWER_CHORD_INTERVALS],
]

const INTERVAL_NAMES = [
    'unison', 'minor second', 'major second', 'minor third', 'major third',
    'perfect fourth', 'tritone', 'perfect fifth', 'minor sixth', 'major sixth',
    'minor seventh', 'major seventh',
]
const ADDED_TONE_NAMES = [
    'root', 'flat ninth', 'ninth', 'sharp ninth', 'major third', 'eleventh',
    'sharp eleventh', 'perfect fifth', 'flat thirteenth', 'thirteenth',
    'minor seventh', 'major seventh',
]
const pitchClass = (note: number): number => ((note % 12) + 12) % 12
const spokenKey = (note: number): string => noteNumberToKeyName(note).replace('#', ' sharp')

export interface ChordDescription {
    readonly name: string
    readonly description: string
    readonly notes: readonly string[]
    readonly root: number | null
    readonly bass: number | null
    readonly matched: boolean
}

// Compile pitch classes and masks once, rather than rebuilding every formula per note event.
const COMPILED_PATTERNS = CHORD_PATTERNS.map(([quality, formula]) => {
    const pattern = [...new Set(formula.map(pitchClass))]
    return { quality, pattern, mask: pattern.reduce((mask, interval) => mask | (1 << interval), 0) }
})

// Harmonic analysis is shared across octaves and doubled notes, retaining bass for inversions.
const findChord = memoizeLRU((mask: number, bass: number) => {
    const pitches = Array.from({ length: 12 }, (_, note) => note).filter(note => mask & (1 << note))
    const candidates = pitches.flatMap(root => {
        const intervals = pitches.map(note => pitchClass(note - root))
        const intervalMask = intervals.reduce((value, interval) => value | (1 << interval), 0)
        return COMPILED_PATTERNS.flatMap(({ quality, pattern, mask: patternMask }) => {
            if ((intervalMask & patternMask) !== patternMask) return []
            if (pattern.length === 2 && pitches.length !== 2) return []
            return [{ root, quality, pattern, extras: intervals.filter(interval => !(patternMask & (1 << interval))) }]
        })
    }).sort((a, b) => a.extras.length - b.extras.length
        || Number(b.root === bass) - Number(a.root === bass))
    return candidates[0]
}, 4096)

const describeVoicing = memoizeLRU((sorted: number[]): ChordDescription => {
    const noteNames = sorted.map(noteNumberToName)
    const bass = sorted[0] ?? null
    const result = (name: string, description: string, root: number | null = null, matched = false): ChordDescription =>
        Object.freeze({ name, description, notes: Object.freeze(noteNames), root, bass, matched })
    if (bass === null) return result('No active notes', 'Play notes to describe a chord.')
    const pitches = [...new Set(sorted.map(pitchClass))]
    if (pitches.length === 1) {
        return result(spokenKey(pitches[0]), sorted.length === 1
            ? `A single ${noteNames[0]} note.` : `${spokenKey(pitches[0])} played in ${sorted.length} octaves.`, pitches[0])
    }

    const mask = pitches.reduce((value, note) => value | (1 << note), 0)
    const best = findChord(mask, pitchClass(bass))
    if (best) {
        const additions = [...best.extras].sort((a, b) => a - b).map(interval => ADDED_TONE_NAMES[interval])
        const name = `${spokenKey(best.root)} ${best.quality}${additions.length ? ` with added ${additions.join(' and ')}` : ''}`
        const bassInterval = pitchClass(bass - best.root)
        const inversionIndex = best.pattern.indexOf(bassInterval)
        const inversion = bassInterval === 0 ? 'root position'
            : inversionIndex > 0 && inversionIndex <= 3
                ? `${['', 'first', 'second', 'third'][inversionIndex]} inversion`
                : 'an inverted voicing'
        return result(name, `${name}, ${inversion}, with ${spokenKey(pitchClass(bass))} in the bass.`, best.root, true)
    }

    if (pitches.length === 2) {
        const distance = sorted.find(note => pitchClass(note) !== pitchClass(bass))! - bass
        const interval = distance === 12 ? 'octave' : INTERVAL_NAMES[pitchClass(distance)]
        return result(`${spokenKey(pitchClass(bass))} ${interval}`, `A ${interval} above ${noteNames[0]}.`)
    }
    const intervals = pitches.filter(note => note !== pitchClass(bass))
        .map(note => INTERVAL_NAMES[pitchClass(note - bass)])
    return result('Unclassified chord', `A note cluster over ${spokenKey(pitchClass(bass))}, containing ${intervals.join(', ')} above the bass.`)
}, 2048)

/** Analyse sounding MIDI notes; normalized voicings share immutable cached descriptions. */
export function describeChord(notes: readonly number[]): ChordDescription {
    const sorted = [...new Set(notes.filter(note => Number.isInteger(note) && note >= 0 && note <= 127))]
        .sort((a, b) => a - b)
    return describeVoicing(sorted)
}

let prewarmed = false
/** Run once before playing: common triads, sevenths and ninths in every key and inversion. */
export function precacheChordDescriptions(): void {
    if (prewarmed) return
    prewarmed = true
    describeChord([])
    const popular = [
        INTERVALS.MAJOR_CHORD_INTERVALS, INTERVALS.MINOR_CHORD_INTERVALS,
        INTERVALS.DIMINISHED_CHORD_INTERVALS, INTERVALS.AUGMENTED_CHORD_INTERVALS,
        INTERVALS.SUSPENDED_2_CHORD_INTERVALS, INTERVALS.SUSPENDED_4_CHORD_INTERVALS,
        INTERVALS.MAJOR_SEVENTH_CHORD_INTERVALS, INTERVALS.MINOR_SEVENTH_CHORD_INTERVALS,
        INTERVALS.DOMINANT_SEVENTH_CHORD_INTERVALS, INTERVALS.MAJOR_NINTH_CHORD_INTERVALS,
        INTERVALS.MINOR_NINTH_CHORD_INTERVALS, INTERVALS.DOMINANT_NINTH_CHORD_INTERVALS,
    ]
    for (let root = 0; root < 12; root++) {
        describeChord([60 + root])
        for (const formula of popular) {
            const voicing = formula.map(interval => 60 + root + interval)
            for (let inversion = 0; inversion < formula.length; inversion++) {
                describeChord(voicing)
                voicing.push(voicing.shift()! + 12)
                voicing.sort((a, b) => a - b)
            }
        }
    }
}
