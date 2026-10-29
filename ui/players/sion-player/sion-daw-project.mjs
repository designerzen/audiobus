import { voices } from "./pop-song.mjs"

/** Shared SiON voices; existing project instrument indices remain stable. */
export const instruments = [
    { name: "PSG square", mml: "%0 @0" },
    { name: "APU pulse", mml: "%1 @0" },
    { name: "Sine", mml: "%5 @0" },
    { name: "Noise / percussion", mml: "%2 @0" },
    ...[
        "FM lead",
        "Clav",
        "Warm pad",
        "Synth bass",
        "Kick",
        "Snare",
        "Hi-hat",
        "Bell",
        "Reed",
        "Piano",
    ].map((name, i) => ({ name, mml: `%6 @${i}` })),
]

export function createProject() {
    return {
        version: 1,
        tempo: 120,
        repeats: 2,
        tracks: [
            {
                name: "Lead",
                instrument: 1,
                volume: 70,
                pan: -16,
                mute: false,
                solo: false,
                mml: "o5 l8 [c e g e a g e d]4",
            },
            {
                name: "Bass",
                instrument: 0,
                volume: 60,
                pan: 0,
                mute: false,
                solo: false,
                mml: "o3 l4 [c r g r f r g r]2",
            },
            {
                name: "Chimes",
                instrument: 2,
                volume: 65,
                pan: 24,
                mute: false,
                solo: false,
                mml: "o6 l4 [r e r g r a r g]2",
            },
            {
                name: "Hi-hat",
                instrument: 3,
                volume: 20,
                pan: 12,
                mute: false,
                solo: false,
                mml: "o5 l16 q1 [c r c r c r c r]8",
            },
        ],
    }
}

/** Validate imported projects before they reach either the UI or the MML compiler. */
export function parseProject(value) {
    const project = typeof value === "string" ? JSON.parse(value) : value
    const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max
    if (
        !project ||
        project.version !== 1 ||
        !integer(project.tempo, 30, 300) ||
        !integer(project.repeats, 1, 8) ||
        !Array.isArray(project.tracks) ||
        project.tracks.length < 1 ||
        project.tracks.length > 16
    ) {
        throw new Error("Choose a SiON DAW project with 1–16 tracks, tempo 30–300 and 1–8 repeats.")
    }
    for (const track of project.tracks) {
        if (
            !track ||
            typeof track.name !== "string" ||
            track.name.length > 80 ||
            !integer(track.instrument, 0, instruments.length - 1) ||
            !integer(track.volume, 0, 100) ||
            !integer(track.pan, -64, 64) ||
            typeof track.mute !== "boolean" ||
            typeof track.solo !== "boolean" ||
            typeof track.mml !== "string" ||
            track.mml.length > 16000 ||
            track.mml.includes(";")
        ) {
            throw new Error(
                "Invalid track. Each track needs one MML part without semicolons (maximum 16,000 characters).",
            )
        }
    }
    // Keep only the supported fields and detach imported objects from editor state.
    return {
        version: 1,
        tempo: project.tempo,
        repeats: project.repeats,
        tracks: project.tracks.map(({ name, instrument, volume, pan, mute, solo, mml }) => ({
            name,
            instrument,
            volume,
            pan,
            mute,
            solo,
            mml,
        })),
    }
}

export function projectMML(value) {
    const project = parseProject(value)
    const solo = project.tracks.some((track) => track.solo && !track.mute)
    const active = project.tracks.filter(
        (track) => !track.mute && (!solo || track.solo) && track.mml.trim(),
    )
    if (!active.length)
        throw new Error("No audible tracks. Add notes, unmute a track or clear Solo.")
    return (
        (active.some((track) => track.instrument >= 4) ? voices + "\n" : "") +
        active
            .map(
                (track) =>
                    `t${project.tempo} ${instruments[track.instrument].mml} @v${Math.round(track.volume * 1.28)} @p${track.pan + 64} o5 l8 [\n${track.mml}\n]${project.repeats};`,
            )
            .join("\n\n")
    )
}