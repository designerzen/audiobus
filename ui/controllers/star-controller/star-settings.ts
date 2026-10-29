/** Musical mappings are creative controller layouts, not emotion/sound associations. */
export const petals = [
    "ecstasy",
    "admiration",
    "terror",
    "amazement",
    "grief",
    "loathing",
    "rage",
    "vigilance",
] as const
export const fifths = [0, 7, 2, 9, 4, 11, 6, 1]
// SVG document order differs between petals. Ranks run from the outer tip (0) inward (3).
export const intensityRanks = [
    [1, 2, 0, 3],
    [3, 1, 2, 0],
    [1, 0, 2, 3],
    [1, 0, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [1, 2, 3, 0],
]
export const pitchNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
export const voicingNames = ["root position", "first inversion", "second inversion", "open voicing"]

export const choices = {
    harmony: ["fifths", "diatonic", "custom"],
    "region-behavior": ["voicing", "complexity", "register", "velocity"],
    "chord-type": ["single", "fifth", "triad", "seventh", "sus2", "sus4", "ninth"],
    "hold-behavior": ["hold", "toggle", "latch"],
    "velocity-mode": ["pressure", "fixed"],
    labels: ["emotion", "chord", "notes", "both"],
    "voice-leading": ["off", "smooth"],
} as const
export const defaults = {
    key: 0,
    transpose: 0,
    harmony: "fifths",
    "custom-roots": fifths.join(","),
    "region-behavior": "voicing",
    "chord-type": "triad",
    "hold-behavior": "hold",
    "velocity-mode": "pressure",
    velocity: 1,
    sensitivity: 1,
    "minimum-velocity": 0.05,
    labels: "both",
    "voice-leading": "off",
} as const
export const numericSettings = {
    key: [0, 11, true],
    transpose: [-24, 24, true],
    velocity: [0.01, 1, false],
    sensitivity: [0.25, 4, false],
    "minimum-velocity": [0.01, 1, false],
} as const
export type Setting = keyof typeof defaults
export type Settings = {
    [K in Setting]: K extends keyof typeof choices
        ? (typeof choices)[K][number]
        : K extends keyof typeof numericSettings
          ? number
          : string
}
export type Preset = "original" | "in-key" | "simple" | "extended"
export const presets: Record<Preset, { label: string; settings: Partial<Settings> }> = {
    original: { label: "Original", settings: {} },
    "in-key": {
        label: "Stay in key",
        settings: { harmony: "diatonic", "voice-leading": "smooth" },
    },
    simple: {
        label: "Simple notes",
        settings: {
            harmony: "diatonic",
            "chord-type": "single",
            "region-behavior": "register",
            "velocity-mode": "fixed",
            velocity: 0.75,
        },
    },
    extended: {
        label: "Extended chords",
        settings: {
            harmony: "diatonic",
            "chord-type": "ninth",
            "region-behavior": "complexity",
            "hold-behavior": "latch",
            "voice-leading": "smooth",
            velocity: 0.8,
        },
    },
}

export function parseRoots(text: string): number[] | null {
    const parts = text.split(",")
    if (parts.length !== 8 || parts.some((part) => !part.trim())) return null
    const values = parts.map(Number)
    return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 11)
        ? values
        : null
}

export function modalScale(scale: "Major" | "Minor", mode: number) {
    const base = scale === "Minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
    return Array.from({ length: 7 }, (_, i) => (base[(mode + i) % 7]! - base[mode]! + 12) % 12)
}

export function petalRoot(settings: Settings, scale: number[], octave: number, petal: number) {
    const offset =
        settings.harmony === "diatonic"
            ? scale[petal % 7]! + Math.floor(petal / 7) * 12
            : (settings.harmony === "custom"
                  ? (parseRoots(settings["custom-roots"]) ?? fifths)
                  : fifths)[petal]!
    return (octave + 1) * 12 + settings.key + settings.transpose + offset
}

export function padChord(
    settings: Settings,
    scale: number[],
    root: number,
    petal: number,
    region: number,
) {
    const rank = intensityRanks[petal]![region]!
    const type =
        settings["region-behavior"] === "complexity"
            ? (["single", "triad", "seventh", "ninth"] as const)[rank]!
            : settings["chord-type"]
    const degrees =
        type === "single"
            ? [0]
            : type === "fifth"
              ? [0, 4]
              : type === "sus2"
                ? [0, 1, 4]
                : type === "sus4"
                  ? [0, 3, 4]
                  : type === "seventh"
                    ? [0, 2, 4, 6]
                    : type === "ninth"
                      ? [0, 2, 4, 6, 8]
                      : [0, 2, 4]
    const degree = settings.harmony === "diatonic" ? petal % 7 : 0
    let notes = degrees.map((interval) => {
        const step = degree + interval
        return root + scale[step % 7]! - scale[degree]! + Math.floor(step / 7) * 12
    })
    if (settings["region-behavior"] === "register")
        notes = notes.map((note) => note + (rank - 1) * 12)
    if (settings["region-behavior"] === "voicing" && notes.length >= 3) {
        if (region === 1 || region === 2) {
            const inversion = region
            notes = [
                ...notes.slice(inversion),
                ...notes.slice(0, inversion).map((note) => note + 12),
            ]
        } else if (region === 3) {
            // Retain the original open triad, and spread larger chords similarly.
            notes = [notes[0]!, ...notes.slice(2), notes[1]! + 12].sort((a, b) => a - b)
        }
    }
    return [...new Set(notes.filter((note) => note >= 0 && note <= 127))]
}

/** Choose an inversion/register with minimal movement; never change pitch classes. */
export function smoothVoicing(notes: number[], previous: number[]) {
    if (!notes.length || !previous.length) return notes
    const source = [...notes].sort((a, b) => a - b)
    const target = [...previous].sort((a, b) => a - b)
    let best = source
    let cost = Infinity
    for (let inversion = 0; inversion < source.length; inversion++) {
        const variant = [
            ...source.slice(inversion),
            ...source.slice(0, inversion).map((note) => note + 12),
        ]
        for (const shift of [-24, -12, 0, 12, 24]) {
            const candidate = variant.map((note) => note + shift)
            if (candidate.some((note) => note < 0 || note > 127)) continue
            const movement = candidate.reduce(
                (sum, note, i) => sum + Math.abs(note - target[Math.min(i, target.length - 1)]!),
                0,
            )
            if (movement < cost) {
                best = candidate
                cost = movement
            }
        }
    }
    return best
}

export function chordName(notes: number[], root: number) {
    const pitch = ((root % 12) + 12) % 12
    const intervals = new Set(notes.map((note) => (((note - root) % 12) + 12) % 12))
    const quality =
        notes.length <= 1
            ? ""
            : intervals.has(3) && intervals.has(6)
              ? "dim"
              : intervals.has(3)
                ? "m"
                : intervals.has(4)
                  ? ""
                  : intervals.has(2)
                    ? "sus2"
                    : intervals.has(5)
                      ? "sus4"
                      : "5"
    const extension = intervals.has(10) ? "7" : intervals.has(11) ? "maj7" : ""
    return (
        pitchNames[pitch]! +
        quality +
        extension +
        (notes.length >= 5 && intervals.has(2) ? "(9)" : "")
    )
}