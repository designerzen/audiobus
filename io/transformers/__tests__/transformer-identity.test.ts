import { describe, it, expect, beforeEach } from 'vitest'
import { IdentityTransformer } from '../transformer-identity'
import type { IAudioCommand } from '../../audio-command-interface'
import AudioCommand from '../../audio-command'
import * as Commands from '../../../commands'

// Mock Timer
const mockTimer = {
    BPM: 120,
    now: 0,
    isRunning: true,
    currentTime: 0
} as any

describe('IdentityTransformer', () => {
    let transformer: IdentityTransformer

    beforeEach(() => {
        transformer = new IdentityTransformer({})
    })

    it('should have correct name', () => {
        expect(transformer.name).toBe('Identity Transformer')
    })

    it('should return unchanged commands', () => {
        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60),
            createAudioCommand(Commands.NOTE_ON, 64),
            createAudioCommand(Commands.NOTE_OFF, 60)
        ]

        const result = transformer.transform(commands, mockTimer)

        expect(result).toEqual(commands)
        expect(result.length).toBe(3)
    })

    it('should handle empty command array', () => {
        const commands: IAudioCommand[] = []
        const result = transformer.transform(commands, mockTimer)

        expect(result).toEqual([])
    })

    it('should preserve command properties', () => {
        const command = createAudioCommand(Commands.NOTE_ON, 72, 100, 0.5)
        const result = transformer.transform([command], mockTimer)

        expect(result[0].number).toBe(72)
        expect(result[0].velocity).toBe(100)
        expect(result[0].startAt).toBe(0.5)
        expect(result[0].type).toBe(Commands.NOTE_ON)
    })
})

function createAudioCommand(
    type: string,
    noteNumber: number,
    velocity: number = 100,
    startAt: number = 0
): IAudioCommand {
    const cmd = new AudioCommand()
    cmd.type = type
    cmd.subtype = type
    cmd.number = noteNumber
    cmd.velocity = velocity
    cmd.startAt = startAt
    cmd.time = 0
    cmd.id = Math.random()
    cmd.endAt = startAt + 1
    cmd.value = 0
    cmd.pitchBend = 0
    cmd.timeCode = 0
    cmd.text = ''
    cmd.raw = new Uint8Array()
    return cmd
}



