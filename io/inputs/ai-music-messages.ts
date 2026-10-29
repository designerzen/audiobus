export const AI_MUSIC_GENERATE = 'ai-music:generate'
export const AI_MUSIC_RESULT = 'ai-music:result'
export const AI_MUSIC_STATUS = 'ai-music:status'
export const AI_MUSIC_ERROR = 'ai-music:error'

export interface AIMusicNote {
    pitch: number
    start: number
    end: number
    velocity: number
    channel: number
}
export interface AIMusicRequest {
    kind: typeof AI_MUSIC_GENERATE
    id: number
    modelId: string
    seed: number[]
    chords: string[]
    temperature: number
}
export type AIMusicResponse =
    | { kind: typeof AI_MUSIC_RESULT; id: number; notes: AIMusicNote[]; steps: number }
    | { kind: typeof AI_MUSIC_STATUS; id: number; status: string }
    | { kind: typeof AI_MUSIC_ERROR; id: number; error: string }

export function validateMusicNotes(value: unknown, steps: number): AIMusicNote[] {
    if (!Number.isInteger(steps) || steps < 1 || steps > 128 || !Array.isArray(value) || !value.length || value.length > 2048 ||
        !value.every(note => note && Number.isInteger(note.pitch) && note.pitch >= 0 && note.pitch <= 127 &&
            Number.isFinite(note.start) && Number.isFinite(note.end) && note.start >= 0 && note.end > note.start && note.end <= steps &&
            Number.isInteger(note.channel) && note.channel >= 1 && note.channel <= 16 &&
            Number.isInteger(note.velocity) && note.velocity >= 1 && note.velocity <= 127)) {
        throw new Error('The AI model returned an invalid or empty MIDI sequence.')
    }
    return value.map(note => ({ pitch: note.pitch, start: note.start, end: note.end, velocity: note.velocity, channel: note.channel }))
        .sort((a, b) => a.start - b.start)
}
