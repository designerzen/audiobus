import { createGenreSong, rhythmPresets } from "./genre-song.mjs"
export { rhythmPresets } from "./genre-song.mjs"
/** Deterministic composition. Legacy grooves use sixteenths; genre arrangements retain swing and metre. */
export const layers = [
    {
        id: "lead",
        name: "Lead melody",
        detail: "A hook that comes back around",
        voice: 0,
        volume: 47,
        pan: -8,
        color: "#b1a0dd",
    },
    {
        id: "counter",
        name: "Countermelody",
        detail: "A little call and response",
        voice: 0,
        volume: 24,
        pan: 25,
        color: "#c3b5e5",
    },
    {
        id: "chord1",
        name: "Chords · root",
        detail: "Three voices, one warm harmony",
        voice: 1,
        volume: 30,
        pan: -25,
        color: "#e3aa77",
    },
    {
        id: "chord2",
        name: "Chords · third",
        detail: "The colour inside each chord",
        voice: 1,
        volume: 25,
        pan: 0,
        color: "#e3aa77",
    },
    {
        id: "chord3",
        name: "Chords · fifth",
        detail: "A wide, open top voice",
        voice: 2,
        volume: 22,
        pan: 25,
        color: "#e3aa77",
    },
    {
        id: "arp",
        name: "Arpeggio",
        detail: "Small notes, constant motion",
        voice: 1,
        volume: 23,
        pan: 35,
        color: "#d8c66e",
    },
    {
        id: "bass",
        name: "Synth bass",
        detail: "The low-end foundation",
        voice: 3,
        volume: 55,
        pan: 0,
        color: "#83b4a2",
    },
    {
        id: "kick",
        name: "Kick drum",
        detail: "A heartbeat for your song",
        voice: 4,
        volume: 65,
        pan: 0,
        color: "#df9388",
    },
    {
        id: "snare",
        name: "Snare",
        detail: "The backbeat and the fills",
        voice: 5,
        volume: 38,
        pan: -8,
        color: "#df9388",
    },
    {
        id: "hats",
        name: "Hi-hats",
        detail: "A little sparkle on top",
        voice: 6,
        volume: 24,
        pan: 18,
        color: "#df9388",
    },
]

// Original SiON / Valsound presets, serialized with SiONVoice.getMML.
export const voices = `
#OPN@0{3 7 31 0 0 0 0 33 0 0 3 0 15 0 0 1 0 30 0 1 7 0 22 0 0 1 0 28 0 0 7 0 18 0 0 6 0 0 0 1 0 0};
#OPN@1{2 6 31 15 8 6 2 35 0 12 3 0 31 6 2 6 2 32 0 3 0 0 31 6 2 6 1 32 0 1 7 0 31 8 6 7 4 0 0 2 0 0};
#OPN@2{3 7 21 0 0 0 0 30 0 1 1 0 14 7 7 6 3 25 0 2 6 0 15 0 0 5 0 38 0 5 6 0 18 0 0 6 0 0 0 2 0 0};
#OPN@3{5 6 31 0 0 0 0 41 0 1 0 0 20 0 0 10 0 0 0 1 1 0 24 0 0 8 0 0 0 1 2 0 20 0 0 10 0 0 0 1 3 0};
#@4{0 0 0 0 63 0 0 28 0 0 1 0 1 0 0 0 0 0};
#@5{0 0 0 17 63 0 0 36 0 0 1 0 1 0 0 0 0 0};
#@6{0 0 0 19 63 0 0 40 0 0 1 0 1 0 0 0 0 0};
#OPN@7{4 3 31 12 0 10 5 38 0 6 3 0 31 8 4 6 11 4 0 2 3 0 31 12 4 6 2 40 0 6 7 0 31 6 4 6 11 0 0 2 7 0};
#OPN@8{3 7 31 0 0 7 0 35 0 4 0 0 25 14 0 4 2 42 0 4 0 0 31 0 0 8 0 38 0 2 0 0 18 7 0 8 1 0 0 1 0 0};
#OPN@9{4 5 31 5 0 0 0 23 0 1 3 0 20 10 3 7 8 0 0 1 3 0 31 3 0 0 0 25 0 1 7 0 31 12 3 7 10 2 0 1 7 0};`

export function randomFromSeed(seed) {
    let state = 2166136261
    for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
    return () => {
        state += 0x6d2b79f5
        let value = Math.imul(state ^ (state >>> 15), 1 | state)
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

export const moodPresets = [
    {
        id: "bright",
        emoji: "😊",
        name: "Happy",
        description: "Bright major chords and a bouncy, rising hook.",
        minor: false,
    },
    {
        id: "dreamy",
        emoji: "😌",
        name: "Calm",
        description: "Spacious phrases, gentle highs and flowing arpeggios.",
        minor: false,
    },
    {
        id: "bittersweet",
        emoji: "😢",
        name: "Sad",
        description: "Minor harmony and a lower, descending melody.",
        minor: true,
    },
    {
        id: "excited",
        emoji: "🤩",
        name: "Excited",
        description: "High hooks, busy arpeggios and sparkling drum fills.",
        minor: false,
    },
    {
        id: "tender",
        emoji: "🥰",
        name: "Tender",
        description: "Warm major harmony with soft, unhurried phrases.",
        minor: false,
    },
    {
        id: "angry",
        emoji: "😠",
        name: "Intense",
        description: "Minor chords, insistent repeated notes and driving drums.",
        minor: true,
    },
]

export function createSong(options = {}) {
    if (rhythmPresets.some((rhythm) => rhythm.id === options.groove))
        return createGenreSong(options, layers, moodPresets, randomFromSeed)
    const settings = {
        seed: String(options.seed || "golden-hour").slice(0, 60),
        tempo: Math.round(Math.min(160, Math.max(75, Number(options.tempo) || 112))),
        key: Math.round(Math.min(11, Math.max(0, Number(options.key) || 0))),
        mood: moodPresets.some((preset) => preset.id === options.mood) ? options.mood : "bright",
        groove: ["pop", "dance", "half"].includes(options.groove) ? options.groove : "pop",
        energy: Math.min(100, Math.max(0, Number(options.energy ?? 65) || 0)),
        length: options.length === "full" ? "full" : "short",
    }
    const random = randomFromSeed(settings.seed)
    const pick = (items) => items[Math.floor(random() * items.length)]
    const minor = moodPresets.find((preset) => preset.id === settings.mood).minor
    const gentle = ["dreamy", "tender", "bittersweet"].includes(settings.mood)
    const driving = ["excited", "angry"].includes(settings.mood)
    const scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
    const pitch = (degree, octave = 5) =>
        octave * 12 + settings.key + scale[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12
    const progression = minor
        ? pick([
              [0, 5, 2, 6],
              [0, 3, 5, 4],
          ])
        : pick([
              [0, 4, 5, 3],
              [0, 5, 3, 4],
              [3, 0, 4, 5],
          ])
    const size = settings.length === "full" ? 2 : 1
    const sections = [
        { name: "Intro", bars: 2 * size, intensity: 0 },
        { name: "Verse", bars: 4 * size, intensity: 1 },
        { name: "Build", bars: 2 * size, intensity: 2 },
        { name: "Chorus", bars: 4 * size, intensity: 3 },
        { name: "Bridge", bars: 2 * size, intensity: 1 },
        { name: "Final chorus", bars: 4 * size, intensity: 3 },
        { name: "Outro", bars: 2 * size, intensity: 0 },
    ].map((section) => ({ ...section, start: 0 }))
    let start = 0
    for (const section of sections) {
        section.start = start
        start += section.bars
    }
    /** @type {Array<Array<{step: number, note: number, duration: number}>>} */
    const emptyBars = []
    const tracks = layers.map((layer) => ({ ...layer, mute: false, bars: [...emptyBars] }))
    const hook = Array.from({ length: 8 }, () => pick([0, 0, 2, 4, 6, 7]))
    for (const section of sections) {
        for (let bar = 0; bar < section.bars; bar++) {
            const chord = progression[bar % 4]
            const active = section.intensity
            const last = section.name === "Outro" && bar === section.bars - 1
            const byId = Object.fromEntries(
                tracks.map((track) => {
                    const events = []
                    track.bars.push(events)
                    return [track.id, events]
                }),
            )
            const add = (id, step, note, duration = 1) => byId[id].push({ step, note, duration })
            for (let voice = 0; voice < 3; voice++) {
                if (settings.groove === "dance" && active > 0 && !last) {
                    for (const step of [2, 6, 10, 14])
                        add(`chord${voice + 1}`, step, pitch(chord + voice * 2, 4), 2)
                } else
                    add(`chord${voice + 1}`, 0, pitch(last ? voice * 2 : chord + voice * 2, 4), 16)
            }
            if (active > 0 || last) {
                const root = last ? 0 : chord
                for (const step of last
                    ? [0]
                    : settings.groove === "dance"
                      ? [0, 4, 8, 12]
                      : [0, 6, 8, 14])
                    add("bass", step, pitch(root + (step === 14 ? 4 : 0), 2), last ? 16 : 2)
            }
            if (active > 0) {
                for (let i = 0; i < 8; i++) {
                    if (i === 7 || (gentle && i % 2 === 1) || (active < 3 && random() > 0.6))
                        continue
                    add(
                        "lead",
                        i * 2,
                        pitch(
                            chord +
                                (settings.mood === "angry"
                                    ? [0, 0, 4, 0][i % 4]
                                    : settings.mood === "bittersweet"
                                      ? hook[(6 - i + (bar % 2)) % 8]
                                      : hook[(i + (bar % 2) * 2) % 8]),
                            settings.mood === "excited"
                                ? 6
                                : settings.mood === "bittersweet"
                                  ? 4
                                  : 5,
                        ),
                        i === 6 ? 4 : 2,
                    )
                }
            }
            if (active >= 2) {
                for (const step of [3, 7, 11, 15])
                    add("counter", step, pitch(chord + pick([2, 4, 6]), 6))
            }
            if (active >= 2 || (settings.mood === "dreamy" && !last)) {
                const spacing = driving || settings.energy > 65 ? 1 : 2
                for (let step = 0; step < 16; step += spacing)
                    add("arp", step, pitch(chord + [0, 2, 4, 7][Math.floor(step / spacing) % 4], 5))
            }
            if (active > 0) {
                const kick =
                    settings.groove === "dance"
                        ? [0, 4, 8, 12]
                        : settings.groove === "half"
                          ? [0, 10]
                          : [
                                0,
                                8,
                                ...(settings.energy > 50 || driving ? [6] : []),
                                ...(driving ? [12] : []),
                            ]
                for (const step of kick.sort((a, b) => a - b)) add("kick", step, 36)
                for (const step of settings.groove === "half" ? [8] : [4, 12])
                    add("snare", step, 60)
                const fill = (bar === section.bars - 1 || driving) && active >= 2
                if (fill) for (const step of [13, 14, 15]) add("snare", step, 60)
                for (
                    let step = 0;
                    step < 16;
                    step += (settings.energy > 75 || driving) && active === 3 ? 1 : gentle ? 4 : 2
                )
                    add("hats", step, 84)
            }
        }
    }
    return {
        settings,
        beats: 4,
        stepsPerBeat: 4,
        rhythm: settings.groove,
        minor: minor,
        sections,
        tracks,
        totalBars: start,
        duration: (start * 240) / settings.tempo,
        title: `${pick(["Velvet", "Golden", "Neon", "Satellite", "Sunday", "Electric"])} ${pick(["Skies", "Hearts", "Daydream", "Summer", "Afterglow", "Motion"])}`,
        chords: progression.map((degree) => {
            const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
            const third = (pitch(degree + 2) - pitch(degree)) % 12
            return names[(settings.key + scale[degree]) % 12] + (third === 3 ? "m" : "")
        }),
    }
}

/** Keep the musical history and mix while changing only upcoming bars. */
export function changeSongMood(song, mood, fromBar = 0) {
    const next = createSong({ ...song.settings, mood })
    const boundary = Math.max(0, Math.min(song.totalBars, Math.floor(fromBar)))
    next.title = song.title
    next.tracks.forEach((track, index) => {
        track.bars = [...song.tracks[index].bars.slice(0, boundary), ...track.bars.slice(boundary)]
        track.mute = song.tracks[index].mute
        track.volume = song.tracks[index].volume
    })
    return next
}

const noteNames = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b"]
function token(note, steps, stepsPerBeat) {
    const prefix = note === null ? "r" : `o${Math.floor(note / 12)} ${noteNames[note % 12]}`
    const parts = []
    const whole = stepsPerBeat * 4
    for (const denominator of [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96]) {
        if (whole % denominator) continue
        const duration = whole / denominator
        while (steps >= duration) {
            parts.push(note === null || !parts.length ? prefix + denominator : "^" + denominator)
            steps -= duration
        }
    }
    return parts.join(" ")
}

/** Serialize one aligned part for reuse by the song generator and track editor. */
export function songPartMML(song, track) {
    const stepsPerBeat = song.stepsPerBeat ?? 4
    const barSteps = (song.beats ?? 4) * stepsPerBeat
    const bars = track.bars.map((events) => {
        let cursor = 0
        const tokens = []
        for (const event of events) {
            if (event.step > cursor) tokens.push(token(null, event.step - cursor, stepsPerBeat))
            tokens.push(token(event.note, event.duration, stepsPerBeat))
            cursor = event.step + event.duration
        }
        if (cursor < barSteps) tokens.push(token(null, barSteps - cursor, stepsPerBeat))
        return tokens.join(" ")
    })
    const gate = ["kick", "snare", "hats"].includes(track.id)
        ? 0
        : track.id.startsWith("chord")
          ? 7
          : 5
    return "q" + gate + " " + bars.join(" ")
}

/** Each part has exactly the same duration, even when muted or resting. */
export function songMML(song) {
    const softness = ["dreamy", "tender", "bittersweet"].includes(song.settings.mood) ? 0.7 : 1
    return (
        voices +
        "\n" +
        song.tracks
            .map(
                (track) =>
                    "t" +
                    song.settings.tempo +
                    " %" +
                    (track.mode ?? 6) +
                    " @" +
                    track.voice +
                    " @v" +
                    (track.mute ? 0 : Math.round(track.volume * softness)) +
                    " @p" +
                    (track.pan + 64) +
                    " " +
                    songPartMML(song, track) +
                    ";",
            )
            .join("\n")
    )
}