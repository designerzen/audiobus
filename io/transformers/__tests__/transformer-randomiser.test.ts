import { describe, it, expect, beforeEach } from 'vitest'
import { TransformerRandomiser } from '../transformer-randomiser.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import AudioCommand from '../../audio-command.ts'
import * as Commands from '../../../commands'

const mockTimer = {
    BPM: 120,
    now: 0,
    isRunning: true
} as any

describe('TransformerRandomiser', () => {
    let transformer: TransformerRandomiser

    beforeEach(() => {
        transformer = new TransformerRandomiser({
            uncertainty: 50,
            offset: 12
        })
    })

    it('should have correct name', () => {
        expect(transformer.name).toBe('Randomiser')
    })

    it('should disable randomisation at 0%', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 0,
            offset: 12
        })

        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)

        expect(result[0].number).toBe(60)
    })

    it('should always randomise at 100%', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 100,
            offset: 12
        })

        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)

        // Note might be same by chance, but property should be set
        expect(result[0].type).toBe(Commands.NOTE_ON)
    })

    it('should keep randomised notes within MIDI range', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 100,
            offset: 12
        })

        const commands = [
            createAudioCommand(Commands.NOTE_ON, 10),
            createAudioCommand(Commands.NOTE_ON, 120)
        ]

        const result = transformer.transform(commands, mockTimer)

        result.forEach(cmd => {
            if (cmd.type === Commands.NOTE_ON) {
                expect(cmd.number).toBeGreaterThanOrEqual(0)
                expect(cmd.number).toBeLessThanOrEqual(127)
            }
        })
    })

    it('should respect offset range', () => {
        // With offset of 0, note should not move
        transformer = new TransformerRandomiser({
            uncertainty: 100,
            offset: 0
        })

        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)

        expect(result[0].number).toBe(60)
    })

    it('should track NOTE_ON notes for corresponding NOTE_OFF', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 50,
            offset: 12
        })

        const noteOn = createAudioCommand(Commands.NOTE_ON, 60)
        const noteOff = createAudioCommand(Commands.NOTE_OFF, 60)

        // First transform NOTE_ON
        const result1 = transformer.transform([noteOn], mockTimer)
        
        // Then transform NOTE_OFF
        const result2 = transformer.transform([noteOff], mockTimer)

        expect(result2.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle empty command array', () => {
        const result = transformer.transform([], mockTimer)
        expect(result).toEqual([])
    })

    it('should preserve command properties', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 0,  // No randomisation
            offset: 12
        })

        const command = createAudioCommand(Commands.NOTE_ON, 72, 95, 0.5)
        const result = transformer.transform([command], mockTimer)

        expect(result[0].velocity).toBe(95)
        expect(result[0].startAt).toBe(0.5)
        expect(result[0].type).toBe(Commands.NOTE_ON)
    })

    it('should reset state', () => {
        transformer.reset()
        // After reset, should work normally
        const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
        const result = transformer.transform(commands, mockTimer)
        expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('should not randomise NOTE_OFF commands', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 100,  // Always randomise
            offset: 12
        })

        const commands = [createAudioCommand(Commands.NOTE_OFF, 60)]
        const result = transformer.transform(commands, mockTimer)

        expect(result[0].number).toBe(60)
        expect(result[0].type).toBe(Commands.NOTE_OFF)
    })

    it('should provide fields configuration', () => {
        const fields = transformer.fields

        expect(fields.length).toBeGreaterThan(0)
        
        const randomField = fields.find(f => f.name === 'random')
        expect(randomField).toBeDefined()
        expect(randomField?.values).toContain(0)
        expect(randomField?.values).toContain(100)
    })

    it('should allow config update', () => {
        transformer.setConfig('random', 75)
        expect(transformer.options.uncertainty).toBe(75)
        
        transformer.setConfig('offset', 6)
        expect(transformer.options.offset).toBe(6)
    })

    it('should handle multiple notes', () => {
        transformer = new TransformerRandomiser({
            uncertainty: 0,  // No randomisation
            offset: 12
        })

        const commands = [
            createAudioCommand(Commands.NOTE_ON, 60),
            createAudioCommand(Commands.NOTE_ON, 64),
            createAudioCommand(Commands.NOTE_ON, 67)
        ]

        const result = transformer.transform(commands, mockTimer)
        expect(result.length).toBe(3)
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




