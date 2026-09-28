import { createAudioCommand } from '../audio-command-factory.ts'
import type { IAudioCommand } from '../audio-command-interface.ts'
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND, MIDI_CLOCK, MIDI_START, MIDI_STOP, MIDI_CONTINUE } from '../commands'

export const POLYPHONIC_PRESSURE = 'polyphonicPressure'
export const CHANNEL_PRESSURE = 'channelPressure'
export const MIDI_MESSAGE = 'midiMessage'

// Commands use one-based channels and MIDI 1 integer values (velocity 0–127,
// pitch bend 0–16383). Keep the original bytes for system and SysEx messages.
export function midiToCommand(bytes: ArrayLike<number>, now: number, from: string): IAudioCommand | undefined {
    const raw = Uint8Array.from(bytes)
    const status = raw[0]
    if (!(status >= 0x80)) return
    const kind = status >> 4
    const length = status < 0xf0 ? (kind === 0xc || kind === 0xd ? 2 : 3)
        : status === 0xf1 || status === 0xf3 ? 2 : status === 0xf2 ? 3 : 1
    if (raw.length < length) return
    const type = status < 0xf0 ? ({ 8: NOTE_OFF, 9: raw[2] === 0 ? NOTE_OFF : NOTE_ON,
        10: POLYPHONIC_PRESSURE, 11: CONTROL_CHANGE, 12: PROGRAM_CHANGE,
        13: CHANNEL_PRESSURE, 14: PITCH_BEND } as Record<number, string>)[kind]
        : ({ 248: MIDI_CLOCK, 250: MIDI_START, 251: MIDI_CONTINUE, 252: MIDI_STOP } as Record<number, string>)[status] ?? MIDI_MESSAGE
    const command = createAudioCommand(type, raw[1] ?? 0, now, from)
    command.raw = raw
    command.channel = status < 0xf0 ? (status & 15) + 1 : 0
    command.velocity = kind === 8 || kind === 9 ? raw[2] : 0
    command.value = kind === 8 || kind === 9 ? raw[1] : kind === 14 ? raw[1] | (raw[2] << 7)
        : kind === 12 || kind === 13 ? raw[1] : raw[2] ?? 0
    if (kind === 14) command.pitchBend = command.value
    return command
}

const byte = (value: number) => Math.max(0, Math.min(127, Math.round(value || 0)))
export function commandToMidi(command: IAudioCommand): number[] | undefined {
    const channel = Math.max(1, Math.min(16, command.channel || 1)) - 1
    const note = byte(command.number)
    switch (command.type) {
        // Rebuild note bytes so transformers can change pitch and velocity.
        case NOTE_ON: return [0x90 | channel, note, byte(command.velocity ?? 127)]
        case NOTE_OFF: return [0x80 | channel, note, byte(command.velocity ?? 0)]
        case CONTROL_CHANGE: return [0xb0 | channel, note, byte(command.value)]
        case PROGRAM_CHANGE: return [0xc0 | channel, byte(command.value ?? command.number)]
        case POLYPHONIC_PRESSURE: return [0xa0 | channel, note, byte(command.value)]
        case CHANNEL_PRESSURE: return [0xd0 | channel, byte(command.value)]
        case PITCH_BEND: {
            const value = Math.max(0, Math.min(16383, Math.round(command.value ?? command.pitchBend ?? 8192)))
            return [0xe0 | channel, value & 127, value >> 7]
        }
        default: return command.raw?.length ? Array.from(command.raw) : undefined
    }
}
