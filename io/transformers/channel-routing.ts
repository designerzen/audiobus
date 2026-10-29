import { CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND } from '../../commands'
import { CHANNEL_PRESSURE, POLYPHONIC_PRESSURE } from '../../midi/midi-command-conversion.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import { copyCommand } from './performance-transformer.ts'

export function routeChannelMessage(command: IAudioCommand, channels: number[]): IAudioCommand[] {
    if (![CONTROL_CHANGE, PROGRAM_CHANGE, PITCH_BEND, CHANNEL_PRESSURE, POLYPHONIC_PRESSURE].includes(command.type)) return [command]
    return [...new Set(channels)].map(channel => copyCommand(command, { channel }))
}
