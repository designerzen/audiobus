import { createSong, randomFromSeed, songPartMML, moodPresets, rhythmPresets } from "./pop-song.mjs"

export { moodPresets, rhythmPresets }
export const keyNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]

/** Seeded motifs, diatonic harmony and voice leading over the shared genre arrangements. */
export function composeSong(options = {}) {
    const song = createSong({ groove: "electronic", ...options })
    const random = randomFromSeed(song.settings.seed + ":theory")
    const pick = (items) => items[Math.floor(random() * items.length)]
    const rhythm = rhythmPresets.find((item) => item.id === song.settings.groove)
    const minor = song.minor
    const scale = rhythm.scale ?? (minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11])
    const inKey = (note) => scale.includes((((note - song.settings.key) % 12) + 12) % 12)
    const snap = (note) => {
        for (let distance = 0; distance < 12; distance++) {
            if (inKey(note - distance)) return note - distance
            if (inKey(note + distance)) return note + distance
        }
        return note
    }
    const rootOf = (label) => keyNames.indexOf(label.replace(/m$/, ""))
    // Preserve characteristic modal / blues progressions; vary functional seven-note harmony.
    const progression =
        scale.length === 7 && !rhythm.roots
            ? pick([
                  [0, 4, 5, 3],
                  [0, 5, 3, 4],
                  [0, 3, 1, 4],
                  [5, 3, 0, 4],
              ])
            : null
    const roots = Array.from({ length: song.totalBars }, (_, bar) =>
        options.harmony?.length
            ? options.harmony[bar % options.harmony.length]
            : progression
              ? (scale[progression[bar % 4]] + song.settings.key) % 12
              : rootOf(song.chords[bar % song.chords.length]),
    )
    for (const track of song.tracks.filter(
        (track) => !["kick", "snare", "hats"].includes(track.id),
    ))
        track.bars.forEach((events, bar) => {
            const old = rootOf(song.chords[bar % song.chords.length])
            let delta = roots[bar] - old
            if (delta > 6) delta -= 12
            if (delta < -6) delta += 12
            for (const note of events) note.note = snap(note.note + delta)
        })
    // Repeat a recognisable two-bar motif, land on chord tones on strong beats,
    // and let each four-bar phrase resolve rather than picking unrelated pitches.
    const motif = Array.from({ length: song.beats * 4 }, () => pick([-2, -1, 0, 1, 2]))
    song.tracks[0].bars = song.tracks[0].bars.map((existing, bar) => {
        if (!existing.length) return []
        const root = 60 + roots[bar]
        const tones = [root, snap(root + 4), snap(root + 7)]
        let previous = root
        return Array.from({ length: song.beats * 2 }, (_, i) => {
            const strong = i % 2 === 0
            const candidate = strong
                ? tones[Math.abs(motif[(bar % 2) * song.beats * 2 + i]) % 3]
                : snap(previous + motif[i] * 2)
            const choices = [candidate - 12, candidate, candidate + 12].filter(
                (note) => note >= 55 && note <= 84,
            )
            const note =
                bar % 4 === 3 && i === song.beats * 2 - 1
                    ? root
                    : choices.sort((a, b) => Math.abs(a - previous) - Math.abs(b - previous))[0]
            previous = note
            return { step: (i * song.stepsPerBeat) / 2, duration: song.stepsPerBeat / 2, note }
        })
    })
    song.chords = roots.slice(0, progression ? 4 : song.chords.length).map((root) => {
        const third = snap(60 + root + 4) - (60 + root)
        return keyNames[root] + (third === 3 ? "m" : "")
    })
    return song
}

export function songProject(song) {
    return {
        version: 1,
        tempo: song.settings.tempo,
        repeats: 1,
        tracks: song.tracks.map((track) => ({
            name: track.name,
            instrument: track.mode === 1 ? 1 : track.voice + 4,
            volume: Math.round(
                (track.volume *
                    (["dreamy", "tender", "bittersweet"].includes(song.settings.mood) ? 0.7 : 1)) /
                    1.28,
            ),
            pan: track.pan,
            mute: track.mute,
            solo: false,
            mml: songPartMML(song, track),
        })),
    }
}