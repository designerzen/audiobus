
export const CHORD_PROGRESSIONS = [
    // 1) Dominante (+7): V
    {
        name: "dominant",
        step: +7,
        types: ["major", "dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 1.0
    },

    // 2) Subdominante (+5): IV
    {
        name: "subdominant",
        step: +5,
        types: ["major", "maj7", "add6", "add9", "add11", "sus2", "sus4"],
        weight: 0.9
    },

    // 3) Tonikaparallele (+9 ≡ -3): vi
    {
        name: "tonicParallel",
        step: +9,
        types: ["minor", "min7", "madd6", "madd9", "minMaj7"],
        weight: 0.85
    },

    // 4) ii (+2): predominant
    {
        name: "predominant_ii",
        step: +2,
        types: ["minor", "min7", "halfdim7", "madd9"],
        weight: 0.75
    },

    // 5) iii (+4): schwache Predominante / Farbe
    {
        name: "predominant_iii",
        step: +4,
        types: ["minor", "min7", "madd9"],
        weight: 0.6
    },

    // 6) vii° (+11 ≡ -1): Leittonakkord
    {
        name: "leadingTone",
        step: +11,
        types: ["diminished", "halfdim7", "dim7"],
        weight: 0.7
    },

    // 7) Parallele Dominante (+2 von Dominante, also V/V etc.) – optional
    {
        name: "secondaryDominant",
        step: +2, // als V/V etc. interpretierbar im Kontext
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.65,
        tag: "secondary"
    },

    // 8) Farb-/Static-Chords (Quartal/Quintal/Power) – „seitwärts“
    {
        name: "color_static",
        step: 0,
        types: ["power5", "quartal", "quintal", "sus2", "sus4", "add9", "madd9"],
        weight: 0.5
    },

    // 9) Chromatische/alterierte Dominante (+1 / -1) – sehr farbig
    {
        name: "chromatic_up",
        step: +1,
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.4
    },
    {
        name: "chromatic_down",
        step: -1,
        types: ["dom7", "7b5", "7sharp5", "7b9", "7sharp9", "7b9b5"],
        weight: 0.4
    }
];